import { createContext } from 'react'

/* 台詞の出し方。1文字ずつ流すか、最初から全部出すか。 */
export type PetSpeechMode = 'typewriter' | 'instant'

export type PetSpeechSettingsValue = {
  speechMode: PetSpeechMode
  setSpeechMode: (mode: PetSpeechMode) => void
}

export const PetSpeechSettingsContext = createContext<PetSpeechSettingsValue | null>(null)
