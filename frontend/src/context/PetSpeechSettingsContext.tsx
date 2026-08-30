import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  PetSpeechSettingsContext,
  type PetSpeechMode,
} from './PetSpeechSettingsContextCore'

const STORAGE_KEY = 'yuragi_strider:pet-speech-mode'

/*
 * 台詞の出し方はアニメーション設定とは別に持つ。
 * 演出は止めたいが会話の間は残したい、逆に演出は見たいが
 * 説明はすぐ読みたい、のどちらも選べるようにするため。
 */
function readStoredPreference(): PetSpeechMode {
  if (typeof window === 'undefined') {
    return 'typewriter'
  }
  return window.localStorage.getItem(STORAGE_KEY) === 'instant' ? 'instant' : 'typewriter'
}

export function PetSpeechSettingsProvider({ children }: { children: ReactNode }) {
  const [speechMode, setSpeechMode] = useState<PetSpeechMode>(readStoredPreference)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, speechMode)
  }, [speechMode])

  const value = useMemo(
    () => ({ speechMode, setSpeechMode }),
    [speechMode],
  )

  return (
    <PetSpeechSettingsContext.Provider value={value}>
      {children}
    </PetSpeechSettingsContext.Provider>
  )
}
