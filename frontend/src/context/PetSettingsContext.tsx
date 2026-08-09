import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { PetSettingsContext } from './PetSettingsContextCore'

const STORAGE_KEY = 'yuragi_strider:pet-visible'

function readStoredPreference(): boolean {
  if (typeof window === 'undefined') {
    return true
  }
  return window.localStorage.getItem(STORAGE_KEY) !== 'off'
}

export function PetSettingsProvider({ children }: { children: ReactNode }) {
  const [petVisible, setPetVisible] = useState(readStoredPreference)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, petVisible ? 'on' : 'off')
  }, [petVisible])

  const value = useMemo(
    () => ({ petVisible, setPetVisible }),
    [petVisible],
  )

  return (
    <PetSettingsContext.Provider value={value}>
      {children}
    </PetSettingsContext.Provider>
  )
}
