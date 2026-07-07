type DragPreviewKind = 'palette' | 'gate' | 'cnot'

export function setCircuitDragPreview(
  event: { dataTransfer: DataTransfer | null },
  label: string,
  kind: DragPreviewKind,
) {
  if (!event.dataTransfer) {
    return
  }

  const preview = document.createElement('div')
  const title = document.createElement('strong')
  const detail = document.createElement('span')
  title.textContent = `Dragging ${label}`
  detail.textContent = kind === 'palette' ? 'Drop on a slot' : 'Move or release outside'
  preview.append(title, detail)
  preview.setAttribute('aria-hidden', 'true')

  const baseStyles = [
    'position: fixed',
    'left: -1000px',
    'top: -1000px',
    'display: grid',
    'gap: 3px',
    'padding: 10px 13px',
    'border-radius: 12px',
    'font: 600 12px/1.2 system-ui, sans-serif',
    'letter-spacing: 0.04em',
    'white-space: nowrap',
    'box-shadow: 0 14px 30px rgba(2, 6, 23, 0.35)',
    'pointer-events: none',
  ]

  const themeStyles =
    kind === 'cnot'
      ? [
          'background: rgba(30, 41, 59, 0.98)',
          'color: #f8fafc',
          'border: 1px solid rgba(148, 163, 184, 0.38)',
        ]
      : kind === 'palette'
        ? [
            'background: rgba(15, 23, 42, 0.98)',
            'color: #e2e8f0',
            'border: 1px solid rgba(96, 165, 250, 0.46)',
          ]
        : [
            'background: rgba(15, 23, 42, 0.98)',
            'color: #f8fafc',
            'border: 1px solid rgba(253, 224, 71, 0.5)',
  ]

  preview.style.cssText = [...baseStyles, ...themeStyles].join('; ')
  title.style.cssText = [
    'display: block',
    'font-size: 15px',
    'font-weight: 800',
    'letter-spacing: 0.02em',
  ].join('; ')
  detail.style.cssText = [
    'display: block',
    'font-size: 11px',
    'font-weight: 600',
    'letter-spacing: 0',
    'opacity: 0.78',
  ].join('; ')
  document.body.appendChild(preview)
  event.dataTransfer.setDragImage(preview, 24, 22)
  window.setTimeout(() => preview.remove(), 0)
}
