import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AdminModeContext } from './AdminModeContextCore'

const STORAGE_KEY = 'yuragi_strider:admin-mode'

/*
 * 管理者モードは設定メニューのスイッチで切り替える。
 * デモ中に手早く出し入れできるよう、URL の ?admin=1 と
 * Ctrl+Alt+Shift+A も同じスイッチを叩く近道として残してある。
 */
function readEnabledFromUrl(): boolean | null {
  if (typeof window === 'undefined') {
    return null
  }

  const requested = new URLSearchParams(window.location.search).get('admin')
  if (requested === null) {
    return null
  }
  return requested !== '0' && requested !== 'off' && requested !== 'false'
}

function readStoredFlag(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return window.localStorage.getItem(STORAGE_KEY) === 'on'
}

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const [adminModeEnabled, setAdminModeEnabled] = useState(
    () => readEnabledFromUrl() ?? readStoredFlag(),
  )

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, adminModeEnabled ? 'on' : 'off')
  }, [adminModeEnabled])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey && event.altKey && event.shiftKey && event.code === 'KeyA') {
        event.preventDefault()
        setAdminModeEnabled((enabled) => !enabled)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const value = useMemo(
    () => ({
      adminModeEnabled,
      setAdminModeEnabled,
      internalInfoVisible: adminModeEnabled,
    }),
    [adminModeEnabled],
  )

  return <AdminModeContext.Provider value={value}>{children}</AdminModeContext.Provider>
}
