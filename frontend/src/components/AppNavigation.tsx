import { useEffect, useState } from 'react'
import './AppNavigation.css'
import { SettingsMenu } from './SettingsMenu'
import { documentationLinks } from '../utils/documentationLinks'

export type NavigationRoute =
  | 'home'
  | 'simulate'
  | 'algorithm-library'
  | 'circuit-studio'
  | 'state-explorer'
  | 'pulse-lab'
  | 'pulse-circuit-studio'
  | 'pulse-state-explorer'
  | 'help'

type AppNavigationProps = {
  currentRoute: NavigationRoute
  onNavigate: (route: NavigationRoute) => void
}

type NavigationItem = { route: NavigationRoute; label: string; detail: string }

const homeItem: NavigationItem = { route: 'home', label: 'ホーム', detail: 'Yuragi-Strider' }

const gateAwareItems: NavigationItem[] = [
  { route: 'simulate', label: 'シミュレーションワークスペース', detail: 'Gate-aware' },
  { route: 'algorithm-library', label: 'アルゴリズム一覧', detail: 'Algorithm Library' },
  { route: 'circuit-studio', label: '回路スタジオ', detail: 'Circuit Studio' },
  { route: 'state-explorer', label: '状態エクスプローラー', detail: 'State Explorer' },
  { route: 'help', label: 'ヘルプ / Q&A', detail: 'Guide' },
]

const pulseItems: NavigationItem[] = [
  { route: 'pulse-lab', label: 'Pulseラボ', detail: 'Pulseワークスペース' },
  { route: 'pulse-circuit-studio', label: 'Pulse 回路スタジオ', detail: 'Pulseシーケンスエディター' },
  { route: 'pulse-state-explorer', label: 'Pulse 状態エクスプローラー', detail: 'Pulse State Explorer' },
]

/* レール左側に出す、現在地の機械的な呼称。 */
const routeDesignations: Record<NavigationRoute, string> = {
  home: 'IDX / PRIMARY TERMINAL',
  simulate: 'SIM / GATE-AWARE',
  'algorithm-library': 'LIB / ALGORITHMS',
  'circuit-studio': 'EDT / CIRCUIT',
  'state-explorer': 'OBS / STATE VECTOR',
  'pulse-lab': 'PLS / WAVEFORM LAB',
  'pulse-circuit-studio': 'PLS / SEQUENCE EDITOR',
  'pulse-state-explorer': 'OBS / PULSE TRAJECTORY',
  help: 'DOC / GUIDE',
}

type NavigationDomain = 'home' | 'gate-aware' | 'pulse'

function navigationDomainForRoute(route: NavigationRoute): NavigationDomain {
  if (route === 'home') {
    return 'home'
  }
  return route === 'pulse-lab'
    || route === 'pulse-circuit-studio'
    || route === 'pulse-state-explorer'
    ? 'pulse'
    : 'gate-aware'
}

function navigationItemsForRoute(route: NavigationRoute): NavigationItem[] {
  const domain = navigationDomainForRoute(route)
  if (domain === 'home') {
    return [homeItem, ...gateAwareItems, ...pulseItems]
  }
  return domain === 'pulse'
    ? [homeItem, ...pulseItems]
    : [homeItem, ...gateAwareItems]
}

export function AppNavigation({ currentRoute, onNavigate }: AppNavigationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const navigationItems = navigationItemsForRoute(currentRoute)
  const domain = navigationDomainForRoute(currentRoute)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function navigate(route: NavigationRoute) {
    setIsOpen(false)
    onNavigate(route)
  }

  return (
    <div className="app-navigation">
      {isOpen ? (
        <button
          className="app-navigation__scrim"
          type="button"
          aria-label="メニューを閉じる"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      {/* 全ページ共通の計器レール。現在地と機体情報をここに集約する。 */}
      <div className="app-navigation__rail">
        <span className="app-navigation__mark">
          YURAGI&ndash;STRIDER
        </span>
        <span className="app-navigation__route">{routeDesignations[currentRoute]}</span>
        <a
          className="app-navigation__docs"
          href={documentationLinks.home}
          target="_blank"
          rel="noreferrer"
          aria-label="ドキュメントサイトを新しいタブで開く"
        >
          DOCS <span aria-hidden="true">↗</span>
        </a>

        <button
          className={`app-navigation__toggle${isOpen ? ' app-navigation__toggle--open' : ''}`}
          type="button"
          aria-label={isOpen ? 'ナビゲーションを閉じる' : 'ナビゲーションを開く'}
          aria-expanded={isOpen}
          aria-controls="global-navigation-menu"
          onClick={() => setIsOpen((open) => !open)}
        >
          <span className="app-navigation__toggle-label" aria-hidden="true">
            {isOpen ? 'CLOSE' : 'MENU'}
          </span>
          <span className="app-navigation__toggle-icon" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
      </div>
      <nav
        id="global-navigation-menu"
        className={`app-navigation__menu${isOpen ? ' app-navigation__menu--open' : ''}`}
        aria-label="ページナビゲーション"
        aria-hidden={!isOpen}
      >
        <div className="app-navigation__menu-header">
          <span>YURAGI-STRIDER</span>
          <small>
            {domain === 'home'
              ? 'モードを選択'
              : domain === 'pulse'
                ? 'Pulseワークスペース'
                : 'Gate-awareワークスペース'}
          </small>
        </div>
        {navigationItems.map((item) => (
          <button
            className={`app-navigation__item${currentRoute === item.route ? ' app-navigation__item--current' : ''}`}
            type="button"
            key={item.route}
            aria-current={currentRoute === item.route ? 'page' : undefined}
            onClick={() => navigate(item.route)}
          >
            <span>{item.label}</span>
            <small>{item.detail}</small>
          </button>
        ))}
        <a
          className="app-navigation__item app-navigation__item--external"
          href={documentationLinks.home}
          target="_blank"
          rel="noreferrer"
        >
          <span>ドキュメントサイト</span>
          <small>Manual / Physics ↗</small>
        </a>
        <SettingsMenu />
      </nav>
    </div>
  )
}
