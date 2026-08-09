import type { CircuitConfig } from './circuitConfig'
import {
  MAX_SUPPORTED_LOGICAL_QUBITS,
  MIN_SUPPORTED_LOGICAL_QUBITS,
} from './circuitEditing'

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
  if (
    !isFiniteInteger(config.logical_qubits) ||
    config.logical_qubits < MIN_SUPPORTED_LOGICAL_QUBITS ||
    config.logical_qubits > MAX_SUPPORTED_LOGICAL_QUBITS
  ) {
    return {
      valid: false,
      message: formatValidationFailure(
        `Logical qubits must be between ${MIN_SUPPORTED_LOGICAL_QUBITS} and ${MAX_SUPPORTED_LOGICAL_QUBITS}.`,
      ),
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
    if (!(isFiniteInteger(state) && (state === 0 || state === 1)) && state !== '+' && state !== '-') {
      return {
        valid: false,
        message: formatValidationFailure(`Initial state at q${index} must be 0, 1, +, or -.`),
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
        gate.type !== 'Y' &&
        gate.type !== 'Z' &&
        gate.type !== 'S' &&
        gate.type !== 'T' &&
        gate.type !== 'RX' &&
        gate.type !== 'RY' &&
        gate.type !== 'RZ' &&
        gate.type !== 'CNOT' &&
        gate.type !== 'CZ' &&
        gate.type !== 'CP' &&
        gate.type !== 'CCX' &&
        gate.type !== 'SWAP' &&
        gate.type !== 'QFT' &&
        gate.type !== 'ORACLE' &&
        gate.type !== 'MEASURE'
        && gate.type !== 'MESSAGE'
      ) {
        return {
          valid: false,
          message: formatValidationFailure(`Unsupported gate type ${gate.type} in column ${columnIndex + 1}.`),
        }
      }

      if (gate.type === 'CCX') {
        const controls = gate.controls ?? []
        const qubits = [...controls, ...gate.targets]
        if (controls.length !== 2 || gate.targets.length !== 1 || new Set(qubits).size !== 3) {
          return {
            valid: false,
            message: formatValidationFailure(`CCX in column ${columnIndex + 1} needs two controls and one different target.`),
          }
        }
        if (qubits.some((qubit) =>
          !isFiniteInteger(qubit) || qubit < 0 || qubit >= config.logical_qubits
        )) {
          return {
            valid: false,
            message: formatValidationFailure(`CCX in column ${columnIndex + 1} uses an out-of-range qubit.`),
          }
        }
      } else if (gate.type === 'CNOT' || gate.type === 'CZ' || gate.type === 'CP') {
        if (!Array.isArray(gate.controls) || gate.controls.length !== 1 || gate.targets.length !== 1) {
          return {
            valid: false,
            message: formatValidationFailure(`${gate.type} in column ${columnIndex + 1} needs one control and one target.`),
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
            message: formatValidationFailure(`${gate.type} in column ${columnIndex + 1} uses an out-of-range qubit.`),
          }
        }

        if (control === target) {
          return {
            valid: false,
            message: formatValidationFailure(`${gate.type} control and target must differ in column ${columnIndex + 1}.`),
          }
        }

        if (hasDuplicateQubits([control, target])) {
          return {
            valid: false,
            message: formatValidationFailure(`A qubit has multiple operations in the same step.`),
          }
        }
      } else if (gate.type === 'SWAP') {
        if (
          gate.targets.length !== 2 ||
          gate.targets[0] === gate.targets[1] ||
          (gate.controls?.length ?? 0) > 0
        ) {
          return {
            valid: false,
            message: formatValidationFailure(`SWAP in column ${columnIndex + 1} needs two different targets and no controls.`),
          }
        }
        if (gate.targets.some((target) =>
          !isFiniteInteger(target) || target < 0 || target >= config.logical_qubits
        )) {
          return {
            valid: false,
            message: formatValidationFailure(`SWAP in column ${columnIndex + 1} uses an out-of-range qubit.`),
          }
        }
      } else if (gate.type === 'QFT' || gate.type === 'ORACLE') {
        if (gate.targets.length < 1 || (gate.controls?.length ?? 0) > 0) {
          return {
            valid: false,
            message: formatValidationFailure(`${gate.type} in column ${columnIndex + 1} needs at least one target and no controls.`),
          }
        }
        if (hasDuplicateQubits(gate.targets)) {
          return {
            valid: false,
            message: formatValidationFailure(`${gate.type} in column ${columnIndex + 1} lists a qubit more than once.`),
          }
        }
        if (gate.targets.some((target) =>
          !isFiniteInteger(target) || target < 0 || target >= config.logical_qubits
        )) {
          return {
            valid: false,
            message: formatValidationFailure(`${gate.type} in column ${columnIndex + 1} uses an out-of-range qubit.`),
          }
        }
        if (gate.type === 'ORACLE') {
          const marked = gate.params?.marked_index ?? 0
          if (!isFiniteInteger(marked) || marked < 0 || marked >= 2 ** gate.targets.length) {
            return {
              valid: false,
              message: formatValidationFailure(
                `ORACLE in column ${columnIndex + 1} marks a state outside its ${gate.targets.length}-qubit register.`,
              ),
            }
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
      if (gate.params?.theta_rad !== undefined && !Number.isFinite(gate.params.theta_rad)) {
        return {
          valid: false,
          message: formatValidationFailure(`Gate theta_rad must be finite.`),
        }
      }
    }

    const occupiedQubits = column.gates.flatMap((gate) =>
      gate.type === 'CNOT' || gate.type === 'CZ' || gate.type === 'CP' || gate.type === 'CCX'
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
