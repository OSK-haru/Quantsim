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
  pulseLabPageSource.includes('Single-pulse experiment.'),
  'Pulse Lab scope boundary is not visible',
)

const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'yuragi-strider-pulse-lab-'))
const temporarySource = path.join(temporaryRoot, 'src')
mkdirSync(path.join(temporarySource, 'utils'), { recursive: true })
mkdirSync(path.join(temporarySource, 'types'), { recursive: true })
writeFileSync(path.join(temporaryRoot, 'package.json'), '{"type":"commonjs"}')

for (const relativePath of ['src/types/pulse.ts', 'src/utils/pulseLab.ts']) {
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
  estimatePulseCost,
  initialPulseLabForm,
  pulseWaveform,
} = require(path.join(temporarySource, 'utils', 'pulseLab.js'))

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
  totalSimulationTimeUs: 0.2,
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

console.log('Pulse Lab payload and waveform contract: PASS')
rmSync(temporaryRoot, { recursive: true, force: true })

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}
