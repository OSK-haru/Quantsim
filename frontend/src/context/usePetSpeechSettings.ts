import { useContext } from 'react'
import { PetSpeechSettingsContext } from './PetSpeechSettingsContextCore'

export function usePetSpeechSettings() {
  const context = useContext(PetSpeechSettingsContext)
  if (context === null) {
    throw new Error('usePetSpeechSettings must be used within PetSpeechSettingsProvider.')
  }

  return context
}
