import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimationSettingsContext } from './AnimationSettingsContextCore'

const STORAGE_KEY = 'yuragi_strider:animations-enabled'

function readStoredPreference(): boolean {
  if (typeof window === 'undefined') {
    return true
  }
  return window.localStorage.getItem(STORAGE_KEY) !== 'off'
}

export function AnimationSettingsProvider({ children }: { children: ReactNode }) {
  const [animationsEnabled, setAnimationsEnabled] = useState(readStoredPreference)

  useEffect(() => {
    document.documentElement.dataset.animations = animationsEnabled ? 'on' : 'off'
    window.localStorage.setItem(STORAGE_KEY, animationsEnabled ? 'on' : 'off')
  }, [animationsEnabled])

  const value = useMemo(
    () => ({ animationsEnabled, setAnimationsEnabled }),
    [animationsEnabled],
  )

  return (
    <AnimationSettingsContext.Provider value={value}>
      {children}
    </AnimationSettingsContext.Provider>
  )
}
