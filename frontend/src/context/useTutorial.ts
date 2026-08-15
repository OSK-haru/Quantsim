import { useContext } from 'react'
import { TutorialContext, type TutorialContextValue } from './TutorialContextCore'

export function useTutorial(): TutorialContextValue {
  const value = useContext(TutorialContext)
  if (value === null) {
    throw new Error('useTutorial must be used within a TutorialProvider.')
  }
  return value
}

/*
 * ペットやカードなど、チュートリアルの外にも置かれる部品用。
 * Provider の外で呼ばれても落とさず、停止中として扱う。
 */
export function useOptionalTutorial(): TutorialContextValue | null {
  return useContext(TutorialContext)
}
