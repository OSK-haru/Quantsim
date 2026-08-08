import { useContext } from 'react'
import { AnimationSettingsContext } from './AnimationSettingsContextCore'

export function useAnimationSettings() {
  const context = useContext(AnimationSettingsContext)
  if (context === null) {
    throw new Error('useAnimationSettings must be used within AnimationSettingsProvider.')
  }

  return context
}
