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

const singleQubitGateTypes: GateType[] = [
  'H', 'X', 'Y', 'Z', 'S', 'T', 'RX', 'RY', 'RZ',
]
const draggableGateTypes = new Set<GateType>([
  'H', 'X', 'Y', 'Z', 'S', 'T', 'RX', 'RY', 'RZ', 'MEASURE',
  'CNOT', 'CZ', 'CP', 'CCX', 'SWAP', 'MESSAGE', 'RECEIVED',
])

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
    const isUnavailable = gateType === 'CCX' && logicalQubits < 3
    const isDraggable = draggableGateTypes.has(gateType) && !isUnavailable
    const label = gateType === 'MEASURE' ? 'M' : gateType

    return (
      <button
        key={gateType}
        type="button"
        className={`gate-palette__button${
          isSelected ? ' gate-palette__button--selected' : ''
        }${isDraggable ? ' gate-palette__button--draggable' : ''}`}
        aria-pressed={isSelected}
        disabled={isUnavailable}
        draggable={isDraggable}
        title={isUnavailable ? 'CCXには3量子ビット以上が必要です' : `${gateType} をクリックまたはドラッグ`}
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
    <section className="gate-palette" aria-label="ゲートパレット">
      <div className="gate-palette__group" role="radiogroup" aria-label="論理量子ビット">
        <span className="gate-palette__label">量子ビット</span>
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
                量子ビット {count}
              </button>
            )
          })}
        </div>
      </div>

      <div className="gate-palette__group" role="toolbar" aria-label="1量子ビットゲート">
        <span className="gate-palette__label">1量子ビット</span>
        <div className="gate-palette__buttons">
          {singleQubitGateTypes.map((gateType) => renderGateButton(gateType))}
        </div>
      </div>

      <div className="gate-palette__group" role="toolbar" aria-label="測定ゲート">
        <span className="gate-palette__label">測定</span>
        <div className="gate-palette__buttons">{renderGateButton('MEASURE')}</div>
      </div>

      <div className="gate-palette__group" role="toolbar" aria-label="制御ゲート">
        <span className="gate-palette__label">制御</span>
        <div className="gate-palette__buttons">
          {renderGateButton('CNOT')}
          {renderGateButton('CZ')}
          {renderGateButton('CP')}
          {renderGateButton('CCX')}
          {renderGateButton('SWAP')}
        </div>
      </div>
      <div className="gate-palette__group" role="toolbar" aria-label="Teleportation display markers">
        <span className="gate-palette__label">通信表示</span>
        <div className="gate-palette__buttons">
          {renderGateButton('MESSAGE')}
          {renderGateButton('RECEIVED')}
        </div>
      </div>
    </section>
  )
}
