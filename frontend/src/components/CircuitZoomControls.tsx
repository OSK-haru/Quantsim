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
    <div className="circuit-zoom-controls" role="group" aria-label="ズーム操作">
      <span className="circuit-workspace__tool-label">表示</span>
      <button type="button" onClick={onZoomOut} title="縮小 (Ctrl/Cmd + -)">
        -
      </button>
      <span className="circuit-zoom-controls__value" aria-label="現在のズーム倍率">
        {Math.round(zoom * 100)}%
      </span>
      <button type="button" onClick={onZoomIn} title="拡大 (Ctrl/Cmd + +)">
        +
      </button>
      <button type="button" onClick={onResetZoom} title="ズームをリセット (Ctrl/Cmd + 0)">
        リセット
      </button>
      <button type="button" onClick={onFitCircuit} title="回路に合わせる (F)">
        合わせる
      </button>
    </div>
  )
}
