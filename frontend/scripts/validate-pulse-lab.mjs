import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pulseLabPageSource = readFileSync(
  path.join(root, 'src/pages/PulseLabPage.tsx'),
  'utf8',
)
assert(
  !pulseLabPageSource.includes('onOpenCircuitStudio'),
  'Pulse Lab must not link to the gate-aware Circuit Studio',
)
assert(
  !pulseLabPageSource.includes('onOpenStateExplorer'),
  'Pulse Lab must not link to the gate-aware State Explorer',
)
assert(
  pulseLabPageSource.includes('onOpenPulseStateExplorer'),
  'Pulse Lab must link to the Pulse-level State Explorer',
)
assert(
  pulseLabPageSource.includes('複数レーン同時実行。'),
  'Pulse Lab scope boundary is not visible',
)
assert(
  !pulseLabPageSource.includes('globalForm.modelId !== QUTRIT_PULSE_MODEL || sequence.length === 0'),
  'an empty qutrit circuit must not fall back to a single pulse',
)
assert(
  pulseLabPageSource.includes('if (sequence.length === 0) {\n    return []'),
  'an empty qutrit circuit must have an empty execution plan',
)

const pulseStateExplorerSource = readFileSync(
  path.join(root, 'src/pages/PulseStateExplorerPage.tsx'),
  'utf8',
)
assert(
  !pulseStateExplorerSource.includes('BlochSphere'),
  'Pulse State Explorer must not render a reduced Bloch sphere',
)
for (const gateAwareModule of [
  'components/BlochSphereExplorer',
  'components/DensityMatrixViewer',
  'components/MetricTimeline',
  'components/PhysicalTimelinePlayback',
  'components/StateProbabilityComparison',
  'context/useCircuitContext',
  'types/simulation',
]) {
  assert(
    !pulseStateExplorerSource.includes(gateAwareModule),
    `Pulse State Explorer must not depend on the gate-aware module ${gateAwareModule}`,
  )
}

const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'yuragi-strider-pulse-lab-'))
const temporarySource = path.join(temporaryRoot, 'src')
mkdirSync(path.join(temporarySource, 'utils'), { recursive: true })
mkdirSync(path.join(temporarySource, 'types'), { recursive: true })
writeFileSync(path.join(temporaryRoot, 'package.json'), '{"type":"commonjs"}')

for (const relativePath of [
  'src/types/pulse.ts',
  'src/types/pulseCircuit.ts',
  'src/utils/pulseDeviceProfiles.ts',
  'src/utils/pulseCircuit.ts',
  'src/utils/pulseLab.ts',
  'src/utils/pulseStateExplorer.ts',
]) {
  const sourcePath = path.join(root, relativePath)
  const outputPath = path.join(
    temporaryRoot,
    relativePath.replace(/\.ts$/, '.js'),
  )
  const output = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  }).outputText
  writeFileSync(outputPath, output)
}

const require = createRequire(import.meta.url)
const {
  buildPulsePayload,
  buildTransmonNetworkPayload,
  estimatePulseCost,
  initialPulseLabForm,
  pulseWaveform,
  sequentialPulseWaveform,
  circuitLaneWaveform,
} = require(path.join(temporarySource, 'utils', 'pulseLab.js'))
const {
  createDefaultPulseCircuit,
  resizePulseCircuit,
} = require(path.join(temporarySource, 'utils', 'pulseCircuit.js'))

const qutritPayload = buildPulsePayload(initialPulseLabForm)
assert(
  qutritPayload.evolution_method === 'fixed_step_rk4',
  'Pulse Lab must preserve the RK4 API default',
)
assert(qutritPayload.anharmonicity_mhz === -100, 'qutrit anharmonicity missing')
assert(qutritPayload.pulse.drag_beta_us === 0.001, 'qutrit DRAG missing')
assert(!('gamma_down_per_us' in qutritPayload.environment), 'inactive two-level rate leaked')

const twoLevelForm = {
  ...initialPulseLabForm,
  modelId: 'driven_two_level_rwa_experimental_v1',
  shape: 'square',
  environmentMode: 'direct_rates',
}
const twoLevelPayload = buildPulsePayload(twoLevelForm)
assert(!('anharmonicity_mhz' in twoLevelPayload), 'qutrit field leaked into two-level payload')
assert(twoLevelPayload.pulse.drag_beta_us === 0, 'two-level DRAG must be zero')
assert(!('sigma_us' in twoLevelPayload.pulse), 'inactive Gaussian field leaked')
assert('gamma_down_per_us' in twoLevelPayload.environment, 'two-level direct rates missing')
assert(!('gamma_10_down_per_us' in twoLevelPayload.environment), 'qutrit rate leaked')

const networkForm = {
  ...initialPulseLabForm,
  modelId: 'driven_coupled_transmon_network_rwa_experimental_v1',
  totalSimulationTimeUs: 0.05,
}
const networkCircuit = resizePulseCircuit(
  createDefaultPulseCircuit(networkForm),
  3,
)
const networkPayload = buildTransmonNetworkPayload(networkForm, networkCircuit)
assert(networkPayload.transmon_count === 3, 'network transmon count missing')
assert(networkPayload.drives.length === 2, 'network lane schedule missing')
assert(networkPayload.couplings.length === 2, 'network nearest-neighbor couplings missing')
assert(networkPayload.evolution_method === 'fixed_step_rk4', 'network must use RK4')

const cptpPayload = buildPulsePayload({
  ...initialPulseLabForm,
  evolutionMethod: 'explicit_cptp',
})
assert(
  cptpPayload.evolution_method === 'explicit_cptp',
  'explicit CPTP selection was not emitted',
)

const costly = estimatePulseCost({
  ...initialPulseLabForm,
  anharmonicityMhz: -250,
  sigmaUs: 0.02,
  totalSimulationTimeUs: 0.5,
})
assert(costly.overBudget, 'known costly qutrit request was not blocked')

const dragWaveform = pulseWaveform(initialPulseLabForm)
assert(
  dragWaveform.some((point) => Math.abs(point.omegaY) > 1e-9),
  'nonzero DRAG did not produce a visible Y quadrature',
)
const zeroDragWaveform = pulseWaveform({ ...initialPulseLabForm, dragBetaUs: 0 })
assert(
  zeroDragWaveform.every((point) => Math.abs(point.omegaY) < 1e-9),
  'zero-phase, zero-DRAG waveform unexpectedly contains Y quadrature',
)

const sequentialWaveform = sequentialPulseWaveform([
  { ...twoLevelForm, pulseDurationUs: 0.01, phaseRad: 0 },
  { ...twoLevelForm, pulseDurationUs: 0.01, phaseRad: Math.PI / 2 },
], 0.005, 5)
assert(
  sequentialWaveform.some((point) => point.timeUs === 0.01 && point.omegaX === 0 && point.omegaY === 0),
  'sequence waveform must return to zero at the start of the idle gap',
)
assert(
  sequentialWaveform.some((point) => point.timeUs === 0.015 && Math.abs(point.omegaY) > 1e-9),
  'second sequence pulse is missing from the scheduled waveform',
)
const emptyCircuitWaveform = sequentialPulseWaveform([], 0.005, 5)
assert(
  emptyCircuitWaveform.every((point) => point.omegaX === 0 && point.omegaY === 0),
  'an empty circuit must render a flat zero waveform',
)

const circuitWaveform = circuitLaneWaveform(networkForm, networkCircuit, 0, 5)
assert(
  circuitWaveform.some((point) => point.timeUs > 0.02),
  'circuit waveform must include every drive on the selected lane',
)

const {
  buildPulseExplorerView,
  nearestPulsePointIndex,
  pulseSetupSignature,
} = require(path.join(temporarySource, 'utils', 'pulseStateExplorer.js'))

const twoLevelView = buildPulseExplorerView(
  twoLevelExplorerResponse(),
  twoLevelForm,
)
assert(twoLevelView.dimension === 2, 'two-level explorer dimension is wrong')
assert(
  twoLevelView.points[1].idealPopulations['1'] === 1,
  'two-level explorer lost the closed-system reference series',
)
assert(
  twoLevelView.hasPerPointDensityMatrix === false,
  'two-level trajectory does not carry per-sample density matrices',
)
assert(twoLevelView.leakageLabel === null, 'two-level model cannot leak out of the qubit space')

const qutritView = buildPulseExplorerView(qutritExplorerResponse(), initialPulseLabForm)
assert(qutritView.dimension === 3, 'qutrit explorer dimension is wrong')
assert(
  qutritView.computationalLabels.join(',') === '0,1',
  'qutrit computational subspace must exclude the leakage level',
)
assert(
  qutritView.points[1].leakage === 0.25,
  'qutrit explorer lost the leakage series',
)
assert(qutritView.hasPerPointDensityMatrix, 'qutrit trajectory carries density matrices')
assert(
  nearestPulsePointIndex(qutritView.points, 0.019) === 1,
  'cursor did not snap to the nearest trajectory sample',
)

const baseSignature = pulseSetupSignature(initialPulseLabForm, networkCircuit)
assert(
  baseSignature === pulseSetupSignature(initialPulseLabForm, networkCircuit),
  'run signature must be stable for an unchanged setup',
)
assert(
  baseSignature !== pulseSetupSignature(
    { ...initialPulseLabForm, temperatureMk: initialPulseLabForm.temperatureMk + 1 },
    networkCircuit,
  ),
  'run signature must change when the environment changes',
)

console.log('Pulse Lab payload and waveform contract: PASS')
console.log('Pulse State Explorer trajectory normalisation: PASS')
rmSync(temporaryRoot, { recursive: true, force: true })

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

/* 状態エクスプローラーの正規化だけを見たいので、軌跡は最小限の2点で作る。 */
function twoLevelExplorerResponse() {
  const point = (timeUs, open1) => ({
    time_us: timeUs,
    segment: timeUs === 0 ? 'pulse' : 'idle',
    open_population_0: 1 - open1,
    open_population_1: open1,
    closed_population_0: 1 - Math.round(open1),
    closed_population_1: Math.round(open1),
    fidelity_to_closed: 0.99,
    purity: 0.98,
  })
  const state = { ...point(0.02, 0.9), open_density_matrix: [[{ real: 0.1, imag: 0 }, { real: 0, imag: 0 }], [{ real: 0, imag: 0 }, { real: 0.9, imag: 0 }]] }
  return {
    contract_version: 'pulse-baseline-a-v1',
    model: { model_id: 'driven_two_level_rwa_experimental_v1' },
    sample_times_us: [0, 0.02],
    trajectory: [point(0, 0), point(0.02, 0.9)],
    pulse_end: state,
    final: state,
    warnings: [],
    limitations: [],
  }
}

function qutritExplorerResponse() {
  const matrix = [
    [{ real: 0.5, imag: 0 }, { real: 0, imag: 0 }, { real: 0, imag: 0 }],
    [{ real: 0, imag: 0 }, { real: 0.25, imag: 0 }, { real: 0, imag: 0 }],
    [{ real: 0, imag: 0 }, { real: 0, imag: 0 }, { real: 0.25, imag: 0 }],
  ]
  const point = (timeUs, leakage) => ({
    time_us: timeUs,
    segment: 'pulse',
    population_0: 0.5,
    population_1: 0.5 - leakage,
    population_2: leakage,
    computational_population: 1 - leakage,
    leakage_probability: leakage,
    population_sum_error: 0,
    purity: 0.9,
    density_matrix: matrix,
  })
  return {
    contract_version: 'pulse-extension-b-v1',
    model: { model_id: 'driven_transmon_qutrit_rwa_experimental_v1', basis_order: ['0', '1', '2'] },
    input: {},
    sample_times_us: [0, 0.02],
    trajectory: [point(0, 0), point(0.02, 0.25)],
    leakage: {
      maximum_recorded_leakage_probability: 0.25,
      leakage_at_pulse_end: 0.25,
      leakage_at_final_time: 0.25,
    },
    pulse_end: point(0.02, 0.25),
    final: point(0.02, 0.25),
    warnings: [],
    limitations: [],
  }
}
