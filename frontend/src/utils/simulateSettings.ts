/*
 * Gate-awareラボの設定と、その初期値。
 *
 * ページ側で useState して持つと、状態エクスプローラーへ寄り道して戻った
 * だけで画面が作り直され、指定した値が初期値へ戻ってしまう。そのため
 * App が持ち、ここには「何を覚えておくか」の形だけを置く。
 */

import type {
  GateAwareEvolutionMethod,
  GateCompilationMode,
  SimulateRequestParameters,
  SimulationBackend,
  SnapshotOptions,
} from '../types/simulation'

export type SimulateSettings = {
  parameters: SimulateRequestParameters
  evolutionMethod: GateAwareEvolutionMethod
  compilationMode: GateCompilationMode
  simulationBackend: SimulationBackend
  snapshotOptions: SnapshotOptions
  customSnapshotTimesInput: string
}

export const initialSimulationParameters: SimulateRequestParameters = {
  device_quality: 0.8,
  temperature_mk: 15.0,
  flux_noise_phi0: 0.000001,
  qubit_frequency_ghz: 5.0,
  t1_max_us: 100.0,
  tphi_max_us: 100.0,
  duration_us: 2.0,
  time_steps: 101,
  fidelity_threshold: 0.9,
}

export const initialSnapshotOptions: SnapshotOptions = {
  enabled: true,
  uniform_count: 10,
  custom_times_us: [],
  include_initial: true,
  include_final: true,
  include_column_boundaries: true,
  include_after_circuit: true,
}

export const initialSimulateSettings: SimulateSettings = {
  parameters: initialSimulationParameters,
  evolutionMethod: 'fixed_step_rk4',
  compilationMode: 'logical_direct',
  simulationBackend: 'python_dense',
  snapshotOptions: initialSnapshotOptions,
  customSnapshotTimesInput: '',
}
