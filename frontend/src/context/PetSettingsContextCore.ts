import { createContext } from 'react'

export type PetSettingsValue = {
  petVisible: boolean
  setPetVisible: (visible: boolean) => void
}

export const PetSettingsContext = createContext<PetSettingsValue | null>(null)
