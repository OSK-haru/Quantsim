import type { SimulationResponse } from '../types/simulation'

export const uiResponseExample: SimulationResponse = {
  circuit: {
    qubit_count: 2,
    columns: [
      {
        id: 'col-1',
        step: 0,
        duration_us: 0.02,
        gates: [
          { label: 'H', type: 'H', qubits: [0], kind: 'single' },
          { label: '', type: 'I', qubits: [1], kind: 'idle' },
        ],
      },
      {
        id: 'col-2',
        step: 1,
        duration_us: 0.2,
        gates: [
          { label: 'CNOT', type: 'CNOT', qubits: [0], kind: 'control' },
          { label: 'CNOT', type: 'CNOT', qubits: [1], kind: 'target' },
        ],
      },
      {
        id: 'col-3',
        step: 2,
        duration_us: null,
        gates: [
          { label: 'M', type: 'Measure', qubits: [0], kind: 'measure' },
          { label: 'M', type: 'Measure', qubits: [1], kind: 'measure' },
        ],
      },
    ],
  },
  parameters: {
    environment_model: 'unified_environment_v1',
    input_mode: 'physical',
    temperature_k: 0.015,
    temperature_mk: 15,
    normalized_temperature: null,
    qubit_frequency_ghz: 5.0,
    device_quality: 0.85,
    flux_noise_phi0: 0.02,
    duration_us: 20,
    time_steps: 51,
    fidelity_threshold: 0.9,
    simulation_backend: 'rust_dense_preview',
  },
  diagnostics: {
    simulation_model: 'gate_aware_open_system',
    evolution_mode: 'gate_aware_hamiltonian_lindblad_v1',
    simulation_backend: 'rust_dense_preview',
    backend_name: 'rust_dense_preview',
    rust_kernel_mode: 'sampled_cleaned_multi_output',
    rust_kernel_call_count: 2,
    rust_kernel_sampled_batch_count: 1,
    backend_fallback_used: false,
    rust_kernel_fallback_used: false,
  },
  summary: {
    final_fidelity: 0.981649092875,
    final_purity: 0.963818205819,
    completion_fidelity: 0.996993298356,
    completion_purity: 0.994004271723,
    effective_time_us: null,
  },
  timeline: [
    { time_us: 0, fidelity: 1.0, purity: 1.0 },
    { time_us: 1, fidelity: 0.997, purity: 0.994 },
    { time_us: 2, fidelity: 0.993, purity: 0.988 },
    { time_us: 3, fidelity: 0.989, purity: 0.98 },
    { time_us: 4, fidelity: 0.985, purity: 0.971 },
    { time_us: 5, fidelity: 0.9816, purity: 0.9638 },
  ],
  output_probabilities: {
    '00': 0.49,
    '01': 0.01,
    '10': 0.01,
    '11': 0.49,
  },
  run: {
    status: 'Mock result loaded',
    selected_backend: 'rust_dense_preview',
    last_run_label: 'Static preview',
    can_run: true,
  },
  warnings: [],
  issues: [],
}
