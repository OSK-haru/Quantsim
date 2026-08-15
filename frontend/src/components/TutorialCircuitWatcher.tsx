import { useEffect } from 'react'
import { useCircuitContext } from '../context/useCircuitContext'
import { useTutorial } from '../context/useTutorial'
import { countCircuitGates, inspectBellProgress } from '../utils/tutorialProgress'

/*
 * 回路から読める達成条件を、チュートリアルへ報告し続けるだけの部品。
 *
 * 表示は持たない。回路スタジオでも実行画面でも同じ回路を見ているので、
 * ページごとに書くのではなく CircuitProvider の直下に1つだけ置く。
 * こうすると、案内の対象ページと利用者がいるページが違っても
 * （「回路を組んできて」と言われて回路スタジオへ寄り道しても）
 * 達成した瞬間に判定が動く。
 */
export function TutorialCircuitWatcher() {
  const { circuitState } = useCircuitContext()
  const { reportCondition } = useTutorial()

  const hasGates = countCircuitGates(circuitState) > 0
  const bellProgress = inspectBellProgress(circuitState)

  useEffect(() => {
    reportCondition('circuit-ready', hasGates)
    reportCondition('h-placed', bellProgress.hasHadamard)
    reportCondition('bell-ready', bellProgress.hasBellPair)
  }, [reportCondition, hasGates, bellProgress.hasHadamard, bellProgress.hasBellPair])

  return null
}
