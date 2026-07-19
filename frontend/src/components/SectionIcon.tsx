import './SectionIcon.css'

export type SectionIconName =
  | 'circuit'
  | 'chip'
  | 'thermometer'
  | 'clock'
  | 'stopwatch'
  | 'gauge'
  | 'chart'
  | 'bars'
  | 'wrench'
  | 'atom'
  | 'braces'
  | 'terminal'
  | 'warning'

type SectionIconProps = {
  name: SectionIconName
}

export function SectionIcon({ name }: SectionIconProps) {
  return (
    <span className="section-icon" aria-hidden="true">
      <svg className="section-icon__svg" viewBox="0 0 24 24" focusable="false">
        {name === 'circuit' ? (
          <>
            <path d="M4 7h5m6 0h5M9 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0ZM4 17h7m4 0h5M11 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" />
          </>
        ) : null}
        {name === 'chip' ? (
          <>
            <rect x="7" y="7" width="10" height="10" rx="2" />
            <path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3" />
          </>
        ) : null}
        {name === 'thermometer' ? (
          <>
            <path d="M10 14.8V5a2 2 0 1 1 4 0v9.8a4 4 0 1 1-4 0Z" />
            <path d="M12 8v8" />
          </>
        ) : null}
        {name === 'clock' ? (
          <>
            <circle cx="12" cy="12" r="8" />
            <path d="M12 7v5l3 2" />
          </>
        ) : null}
        {name === 'stopwatch' ? (
          <>
            <path d="M10 3h4m-2 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z" />
            <path d="M12 10v4l3-1" />
          </>
        ) : null}
        {name === 'gauge' ? (
          <>
            <path d="M4 16a8 8 0 1 1 16 0" />
            <path d="M12 16l4-6" />
            <path d="M7 16h10" />
          </>
        ) : null}
        {name === 'chart' ? (
          <>
            <path d="M4 18h16" />
            <path d="M5 15l4-4 4 2 5-7" />
            <circle cx="9" cy="11" r="1" />
            <circle cx="13" cy="13" r="1" />
          </>
        ) : null}
        {name === 'bars' ? (
          <>
            <path d="M5 19V9m7 10V5m7 14v-7" />
            <path d="M3 19h18" />
          </>
        ) : null}
        {name === 'wrench' ? (
          <>
            <path d="M14 5a5 5 0 0 0 5 5l-8.5 8.5a2.1 2.1 0 0 1-3-3L16 7a5 5 0 0 1-2-2Z" />
          </>
        ) : null}
        {name === 'atom' ? (
          <>
            <circle cx="12" cy="12" r="1.5" />
            <ellipse cx="12" cy="12" rx="8" ry="3.5" />
            <ellipse cx="12" cy="12" rx="8" ry="3.5" transform="rotate(60 12 12)" />
            <ellipse cx="12" cy="12" rx="8" ry="3.5" transform="rotate(120 12 12)" />
          </>
        ) : null}
        {name === 'braces' ? (
          <>
            <path d="M8 5c-2 0-2 2-2 3v1c0 1-1 2-2 2 1 0 2 1 2 2v3c0 1 0 3 2 3" />
            <path d="M16 5c2 0 2 2 2 3v1c0 1 1 2 2 2-1 0-2 1-2 2v3c0 1 0 3-2 3" />
          </>
        ) : null}
        {name === 'terminal' ? (
          <>
            <rect x="4" y="5" width="16" height="14" rx="2" />
            <path d="M7 10l3 2-3 2m5 2h5" />
          </>
        ) : null}
        {name === 'warning' ? (
          <>
            <path d="M12 4 21 19H3L12 4Z" />
            <path d="M12 9v4m0 3h.01" />
          </>
        ) : null}
      </svg>
    </span>
  )
}
