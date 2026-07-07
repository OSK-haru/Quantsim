import { useId, useState, type ReactNode } from 'react'
import './ResultDrawer.css'

type ResultDrawerProps = {
  eyebrow: string
  title: string
  description?: string
  defaultOpen?: boolean
  children: ReactNode
}

export function ResultDrawer({
  eyebrow,
  title,
  description,
  defaultOpen = false,
  children,
}: ResultDrawerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <section className="result-drawer" data-open={isOpen}>
      <div className="result-drawer__header">
        <div className="result-drawer__heading">
          <div className="result-drawer__eyebrow">{eyebrow}</div>
          <h3 className="result-drawer__title">{title}</h3>
          {description ? <p className="result-drawer__description">{description}</p> : null}
        </div>
        <button
          className="result-drawer__toggle"
          type="button"
          aria-controls={panelId}
          aria-expanded={isOpen}
          aria-label={`${isOpen ? 'Hide' : 'Show'} ${title}`}
          onClick={() => setIsOpen((next) => !next)}
        >
          {isOpen ? 'Hide details' : 'Show details'}
        </button>
      </div>

      <div className="result-drawer__body" id={panelId} hidden={!isOpen}>
        {children}
      </div>
    </section>
  )
}
