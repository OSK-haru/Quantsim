import { useEffect, useState } from 'react'
import './AppNavigation.css'

export type NavigationRoute =
  | 'home'
  | 'simulate'
  | 'circuit-studio'
  | 'state-explorer'
  | 'pulse-lab'
  | 'pulse-circuit-studio'
  | 'help'

type AppNavigationProps = {
  currentRoute: NavigationRoute
  onNavigate: (route: NavigationRoute) => void
}

type NavigationItem = { route: NavigationRoute; label: string; detail: string }

const homeItem: NavigationItem = { route: 'home', label: 'ホーム', detail: 'QuantaScope' }

const gateAwareItems: NavigationItem[] = [
  { route: 'simulate', label: 'シミュレーションラボ', detail: 'Gate-aware' },
  { route: 'circuit-studio', label: '回路スタジオ', detail: 'Circuit Studio' },
  { route: 'state-explorer', label: '状態エクスプローラー', detail: 'State Explorer' },
  { route: 'help', label: 'ヘルプ / Q&A', detail: 'Guide' },
]

const pulseItems: NavigationItem[] = [
  { route: 'pulse-lab', label: 'Pulse Lab', detail: 'Pulse workspace' },
  { route: 'pulse-circuit-studio', label: 'Pulse 回路スタジオ', detail: 'Pulse sequence editor' },
]

type NavigationDomain = 'home' | 'gate-aware' | 'pulse'

function navigationDomainForRoute(route: NavigationRoute): NavigationDomain {
  if (route === 'home') {
    return 'home'
  }
  return route === 'pulse-lab' || route === 'pulse-circuit-studio'
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
      <button
        className={`app-navigation__toggle${isOpen ? ' app-navigation__toggle--open' : ''}`}
        type="button"
        aria-label={isOpen ? 'ナビゲーションを閉じる' : 'ナビゲーションを開く'}
        aria-expanded={isOpen}
        aria-controls="global-navigation-menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      <nav
        id="global-navigation-menu"
        className={`app-navigation__menu${isOpen ? ' app-navigation__menu--open' : ''}`}
        aria-label="ページナビゲーション"
        aria-hidden={!isOpen}
      >
        <div className="app-navigation__menu-header">
          <span>QUANTASCOPE</span>
          <small>
            {domain === 'home'
              ? 'モードを選択'
              : domain === 'pulse'
                ? 'Pulse workspace'
                : 'Gate-aware workspace'}
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
      </nav>
    </div>
  )
}
