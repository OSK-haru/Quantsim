import './GatePalette.css'
import type { GateType } from '../types/circuit'
import { setCircuitDragPreview } from '../utils/dragPreview'

type GatePaletteProps = {
  selectedGateType: GateType | null
  onSelectGateType: (gateType: GateType | null) => void
  onResetToBell: () => void
  statusText: string
  canUndo: boolean
  canRedo: boolean
  canDeleteSelected: boolean
  canClearCircuit: boolean
  onUndo: () => void
  onRedo: () => void
  onDeleteSelected: () => void
  onClearCircuit: () => void
  onGateDragStart: (gateType: GateType) => void
  onGateDragEnd: () => void
}

const placeableGateTypes: GateType[] = ['H', 'X', 'Z', 'MEASURE', 'CNOT']
const draggableGateTypes = new Set<GateType>(['H', 'X', 'Z', 'MEASURE', 'CNOT'])

export function GatePalette({
  selectedGateType,
  onSelectGateType,
  onResetToBell,
  statusText,
  canUndo,
  canRedo,
  canDeleteSelected,
  canClearCircuit,
  onUndo,
  onRedo,
  onDeleteSelected,
  onClearCircuit,
  onGateDragStart,
  onGateDragEnd,
}: GatePaletteProps) {
  return (
    <section className="gate-palette" aria-label="Gate palette">
      <div className="gate-palette__header">
        <div>
          <div className="gate-palette__eyebrow">Editor</div>
          <h2 className="gate-palette__title">Gate palette</h2>
        </div>
        <button className="gate-palette__reset" type="button" onClick={onResetToBell}>
          Reset to Bell
        </button>
      </div>

      <div className="gate-palette__buttons" role="toolbar" aria-label="Placeable gates">
        {placeableGateTypes.map((gateType) => {
          const isSelected = selectedGateType === gateType
          const isDraggable = draggableGateTypes.has(gateType)
          return (
            <button
              key={gateType}
              type="button"
              className={`gate-palette__button${
                isSelected ? ' gate-palette__button--selected' : ''
              }${isDraggable ? ' gate-palette__button--draggable' : ''}`}
              aria-pressed={isSelected}
              draggable={isDraggable}
              title={
                isDraggable
                  ? `${gateType} can be dragged to the circuit.`
                  : 'CNOT uses two-click placement.'
              }
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
              {gateType}
            </button>
          )
        })}
      </div>

      <div className="gate-palette__actions" role="group" aria-label="Circuit edit controls">
        <button className="gate-palette__action" type="button" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <button className="gate-palette__action" type="button" onClick={onRedo} disabled={!canRedo}>
          Redo
        </button>
        <button
          className="gate-palette__action"
          type="button"
          onClick={onDeleteSelected}
          disabled={!canDeleteSelected}
        >
          Delete selected
        </button>
        <button
          className="gate-palette__action"
          type="button"
          onClick={onClearCircuit}
          disabled={!canClearCircuit}
        >
          Clear circuit
        </button>
      </div>

      <p className="gate-palette__status">{statusText}</p>
    </section>
  )
}
