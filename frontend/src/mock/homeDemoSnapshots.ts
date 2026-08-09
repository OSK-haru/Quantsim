import type { StateSnapshot } from '../types/simulation'

// A single qubit starting in |+> (Bloch vector x=1) relaxing toward |0> under
// T1/T2-style decay, used only to drive the home page's autoplaying Bloch
// sphere preview with the real BlochSphereExplorer component.
const DEMO_T1_US = 6
const DEMO_T2_US = 4
const DEMO_STEP_COUNT = 9

function densitySnapshotForTime(index: number, timeUs: number): StateSnapshot {
  const x = Math.exp(-timeUs / DEMO_T2_US)
  const z = 1 - Math.exp(-timeUs / DEMO_T1_US)

  return {
    index,
    time_us: timeUs,
    kind: index === 0 ? 'initial' : 'uniform_time',
    density_matrix: {
      real: [
        [(1 + z) / 2, x / 2],
        [x / 2, (1 - z) / 2],
      ],
      imag: [
        [0, 0],
        [0, 0],
      ],
    },
  }
}

export const homeDemoSnapshots: StateSnapshot[] = Array.from(
  { length: DEMO_STEP_COUNT },
  (_, index) => densitySnapshotForTime(index, index),
)
