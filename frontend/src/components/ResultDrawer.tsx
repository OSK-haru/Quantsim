import { useId, useState, type ReactNode } from 'react'
import './ResultDrawer.css'
import { SectionHeader } from './SectionHeader'
import type { SectionIconName } from './SectionIcon'

type ResultDrawerProps = {
  eyebrow: string
  title: string
  icon?: SectionIconName
  description?: string
  defaultOpen?: boolean
  children: ReactNode
}

export function ResultDrawer({
  eyebrow,
  title,
  icon = 'terminal',
  description,
  defaultOpen = false,
  children,
}: ResultDrawerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <section className="result-drawer" data-open={isOpen}>
      <div className="result-drawer__header">
        <SectionHeader
          className="result-drawer__heading"
          eyebrow={eyebrow}
          title={title}
          icon={icon}
          description={description}
          headingLevel="h3"
        />
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
