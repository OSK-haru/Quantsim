import './SectionHeader.css'
import { SectionIcon, type SectionIconName } from './SectionIcon'

type SectionHeaderProps = {
  icon: SectionIconName
  eyebrow?: string
  title: string
  description?: string
  headingLevel?: 'h2' | 'h3'
  className?: string
}

export function SectionHeader({
  icon,
  eyebrow,
  title,
  description,
  headingLevel = 'h2',
  className = '',
}: SectionHeaderProps) {
  const HeadingTag = headingLevel

  return (
    <div className={`section-header${className ? ` ${className}` : ''}`}>
      <SectionIcon name={icon} />
      <div className="section-header__copy">
        {eyebrow ? <div className="section-header__eyebrow">{eyebrow}</div> : null}
        <HeadingTag className="section-header__title">{title}</HeadingTag>
        {description ? (
          <p className="section-header__description">{description}</p>
        ) : null}
      </div>
    </div>
  )
}
