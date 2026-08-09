import { useContext } from 'react'
import { PetSettingsContext } from './PetSettingsContextCore'

export function usePetSettings() {
  const context = useContext(PetSettingsContext)
  if (context === null) {
    throw new Error('usePetSettings must be used within PetSettingsProvider.')
  }

  return context
}
