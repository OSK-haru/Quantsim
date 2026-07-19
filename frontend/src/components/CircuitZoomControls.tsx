import './CircuitZoomControls.css'

type CircuitZoomControlsProps = {
  zoom: number
  onZoomOut: () => void
  onZoomIn: () => void
  onResetZoom: () => void
  onFitCircuit: () => void
}

export function CircuitZoomControls({
  zoom,
  onZoomOut,
  onZoomIn,
  onResetZoom,
  onFitCircuit,
}: CircuitZoomControlsProps) {
  return (
    <div className="circuit-zoom-controls" role="group" aria-label="Zoom controls">
      <span className="circuit-workspace__tool-label">View</span>
      <button type="button" onClick={onZoomOut} title="Zoom out (Ctrl/Cmd + -)">
        -
      </button>
      <span className="circuit-zoom-controls__value" aria-label="Current zoom">
        {Math.round(zoom * 100)}%
      </span>
      <button type="button" onClick={onZoomIn} title="Zoom in (Ctrl/Cmd + +)">
        +
      </button>
      <button type="button" onClick={onResetZoom} title="Reset zoom (Ctrl/Cmd + 0)">
        Reset
      </button>
      <button type="button" onClick={onFitCircuit} title="Fit circuit (F)">
        Fit
      </button>
    </div>
  )
}
