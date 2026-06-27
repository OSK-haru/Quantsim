export type OutputProbabilities = Record<string, number>

export type MockSimulationResult = {
  final_fidelity: number
  final_purity: number
  completion_fidelity: number
  completion_purity: number
  effective_time_us: number | null
  output_probabilities: OutputProbabilities
}
