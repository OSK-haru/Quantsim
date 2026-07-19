import './GatePalette.css'
import type { GateType } from '../types/circuit'
import { setCircuitDragPreview } from '../utils/dragPreview'

type GatePaletteProps = {
  selectedGateType: GateType | null
  logicalQubits: number
  onSelectGateType: (gateType: GateType | null) => void
  onSelectLogicalQubits: (logicalQubits: number) => void
  onGateDragStart: (gateType: GateType) => void
  onGateDragEnd: () => void
}

const singleQubitGateTypes: GateType[] = ['H', 'X', 'Z']
const draggableGateTypes = new Set<GateType>(['H', 'X', 'Z', 'MEASURE', 'CNOT'])

export function GatePalette({
  selectedGateType,
  logicalQubits,
  onSelectGateType,
  onSelectLogicalQubits,
  onGateDragStart,
  onGateDragEnd,
}: GatePaletteProps) {
  function renderGateButton(gateType: GateType) {
    const isSelected = selectedGateType === gateType
    const isDraggable = draggableGateTypes.has(gateType)
    const label = gateType === 'MEASURE' ? 'M' : gateType

    return (
      <button
        key={gateType}
        type="button"
        className={`gate-palette__button${
          isSelected ? ' gate-palette__button--selected' : ''
        }${isDraggable ? ' gate-palette__button--draggable' : ''}`}
        aria-pressed={isSelected}
        draggable={isDraggable}
        title={`Click or drag ${gateType}`}
        onDragStart={(event) => {
          if (!isDraggable) {
            event.preventDefault()
            return
          }
          event.dataTransfer.effectAllowed = 'copy'
          event.dataTransfer.setData('text/plain', `palette:${gateType}`)
          setCircuitDragPreview(event, gateType, 'palette')
          onGateDragStart(gateType)
        }}
        onDragEnd={onGateDragEnd}
        onClick={() => onSelectGateType(gateType)}
      >
        {label}
      </button>
    )
  }

  return (
    <section className="gate-palette" aria-label="Gate palette">
      <div className="gate-palette__group" role="radiogroup" aria-label="Logical qubits">
        <span className="gate-palette__label">Qubits</span>
        <div className="gate-palette__qubit-selector-buttons">
          {[2, 3, 4].map((count) => {
            const isSelected = logicalQubits === count
            return (
              <button
                key={count}
                type="button"
                className={`gate-palette__qubit-button${
                  isSelected ? ' gate-palette__qubit-button--selected' : ''
                }`}
                aria-pressed={isSelected}
                onClick={() => onSelectLogicalQubits(count)}
              >
                {count} qubits
              </button>
            )
          })}
        </div>
      </div>

      <div className="gate-palette__group" role="toolbar" aria-label="Single-qubit gates">
        <span className="gate-palette__label">1-qubit</span>
        <div className="gate-palette__buttons">
          {singleQubitGateTypes.map((gateType) => renderGateButton(gateType))}
        </div>
      </div>

      <div className="gate-palette__group" role="toolbar" aria-label="Measurement gates">
        <span className="gate-palette__label">Measure</span>
        <div className="gate-palette__buttons">{renderGateButton('MEASURE')}</div>
      </div>

      <div className="gate-palette__group" role="toolbar" aria-label="Controlled gates">
        <span className="gate-palette__label">Control</span>
        <div className="gate-palette__buttons">{renderGateButton('CNOT')}</div>
      </div>
    </section>
  )
}
