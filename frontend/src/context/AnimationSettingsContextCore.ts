import { createContext } from 'react'

export type AnimationSettingsValue = {
  animationsEnabled: boolean
  setAnimationsEnabled: (enabled: boolean) => void
}

export const AnimationSettingsContext = createContext<AnimationSettingsValue | null>(null)
