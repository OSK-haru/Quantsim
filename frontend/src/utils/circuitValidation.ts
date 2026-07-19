import type { CircuitConfig } from './circuitConfig'

export type CircuitValidationResult = {
  valid: boolean
  message: string | null
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function formatValidationFailure(detail: string) {
  return `This circuit was not simulated. ${detail} The previous result is still shown.`
}

function hasDuplicateQubits(values: number[]) {
  return new Set(values).size !== values.length
}

export function validateCircuitConfigForRun(config: CircuitConfig): CircuitValidationResult {
  if (!isFiniteInteger(config.logical_qubits) || config.logical_qubits < 2 || config.logical_qubits > 4) {
    return {
      valid: false,
      message: formatValidationFailure('Logical qubits must be between 2 and 4.'),
    }
  }

  if (!Array.isArray(config.initial_states)) {
    return {
      valid: false,
      message: formatValidationFailure('Initial states must be an array.'),
    }
  }

  if (config.initial_states.length !== config.logical_qubits) {
    return {
      valid: false,
      message: formatValidationFailure('Initial states must match the selected qubit count.'),
    }
  }

  for (let index = 0; index < config.initial_states.length; index += 1) {
    const state = config.initial_states[index]
    if (!isFiniteInteger(state) || (state !== 0 && state !== 1)) {
      return {
        valid: false,
        message: formatValidationFailure(`Initial state at q${index} must be 0 or 1.`),
      }
    }
  }

  if (!Array.isArray(config.columns)) {
    return {
      valid: false,
      message: formatValidationFailure('Columns must be an array.'),
    }
  }

  for (let columnIndex = 0; columnIndex < config.columns.length; columnIndex += 1) {
    const column = config.columns[columnIndex]
    if (!column || !Array.isArray(column.gates)) {
      return {
        valid: false,
        message: formatValidationFailure(`Column ${columnIndex + 1} is invalid.`),
      }
    }

    for (let gateIndex = 0; gateIndex < column.gates.length; gateIndex += 1) {
      const gate = column.gates[gateIndex]
      if (!gate || typeof gate.type !== 'string' || !Array.isArray(gate.targets)) {
        return {
          valid: false,
          message: formatValidationFailure(`Gate ${gateIndex + 1} in column ${columnIndex + 1} is invalid.`),
        }
      }

      if (
        gate.type !== 'H' &&
        gate.type !== 'X' &&
        gate.type !== 'Z' &&
        gate.type !== 'CNOT' &&
        gate.type !== 'MEASURE'
      ) {
        return {
          valid: false,
          message: formatValidationFailure(`Unsupported gate type ${gate.type} in column ${columnIndex + 1}.`),
        }
      }

      if (gate.type === 'CNOT') {
        if (!Array.isArray(gate.controls) || gate.controls.length !== 1 || gate.targets.length !== 1) {
          return {
            valid: false,
            message: formatValidationFailure(`CNOT in column ${columnIndex + 1} needs one control and one target.`),
          }
        }

        const [control] = gate.controls
        const [target] = gate.targets
        if (
          !isFiniteInteger(control) ||
          !isFiniteInteger(target) ||
          control < 0 ||
          target < 0 ||
          control >= config.logical_qubits ||
          target >= config.logical_qubits
        ) {
          return {
            valid: false,
            message: formatValidationFailure(`CNOT in column ${columnIndex + 1} uses an out-of-range qubit.`),
          }
        }

        if (control === target) {
          return {
            valid: false,
            message: formatValidationFailure(`CNOT control and target must differ in column ${columnIndex + 1}.`),
          }
        }

        if (hasDuplicateQubits([control, target])) {
          return {
            valid: false,
            message: formatValidationFailure(`A qubit has multiple operations in the same step.`),
          }
        }
      } else {
        if (gate.targets.length !== 1) {
          return {
            valid: false,
            message: formatValidationFailure(`${gate.type} in column ${columnIndex + 1} needs one target.`),
          }
        }

        if (gate.controls !== undefined && gate.controls.length > 0) {
          return {
            valid: false,
            message: formatValidationFailure(`${gate.type} in column ${columnIndex + 1} cannot have controls.`),
          }
        }

        const [target] = gate.targets
        if (!isFiniteInteger(target) || target < 0 || target >= config.logical_qubits) {
          return {
            valid: false,
            message: formatValidationFailure(`${gate.type} in column ${columnIndex + 1} uses an out-of-range qubit.`),
          }
        }
      }

      if (gate.params?.duration_us !== undefined && !isFiniteNonNegativeNumber(gate.params.duration_us)) {
        return {
          valid: false,
          message: formatValidationFailure(`Gate durations must be a finite number greater than or equal to 0.`),
        }
      }
    }

    const occupiedQubits = column.gates.flatMap((gate) =>
      gate.type === 'CNOT'
        ? [...(gate.controls ?? []), ...gate.targets]
        : [...gate.targets],
    )

    if (hasDuplicateQubits(occupiedQubits)) {
      return {
        valid: false,
        message: formatValidationFailure('A qubit has multiple operations in the same step.'),
      }
    }
  }

  return { valid: true, message: null }
}
