import { useEffect, useState } from 'react'
import { apiUrl } from '../utils/apiBase'

/*
 * フロントとAPIは別々にデプロイされる。APIだけ古いと、UIがそのビルドの知らない
 * model_id を送り、実行時に422で初めて露見する。ユーザーには「設定が悪い」と
 * 読めてしまい、しかも自分では直せない。実行前に切り分けるため、起動時に
 * /api/health が申告するモデル一覧と、UIが送るIDを突き合わせる。
 */

export type PulseApiCompatibility =
  /** 判定前。実行を止める理由にはしない。 */
  | { state: 'checking' }
  /** APIに到達できない。古いのではなく、落ちているか未起動。 */
  | { state: 'unreachable' }
  /** 一覧を申告しない古いビルド。個別のIDは判定できない。 */
  | { state: 'unknown' }
  | { state: 'ready'; supportedModels: ReadonlySet<string> }

type HealthResponse = {
  pulse_models?: unknown
}

export function usePulseApiCompatibility(): PulseApiCompatibility {
  const [compatibility, setCompatibility] = useState<PulseApiCompatibility>({ state: 'checking' })

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    async function probe() {
      try {
        const response = await fetch(apiUrl('/api/health'), {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`health ${response.status}`)
        }
        const parsed = (await response.json()) as HealthResponse
        if (cancelled) {
          return
        }
        const models = parsed.pulse_models
        /* 一覧が無いのは「モデルが無い」ではなく「申告しない古いビルド」。 */
        if (!Array.isArray(models) || models.some((model) => typeof model !== 'string')) {
          setCompatibility({ state: 'unknown' })
          return
        }
        setCompatibility({ state: 'ready', supportedModels: new Set(models as string[]) })
      } catch {
        if (!cancelled) {
          setCompatibility({ state: 'unreachable' })
        }
      }
    }

    void probe()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  return compatibility
}

/**
 * Returns why `modelId` cannot run, or null when it can (or when we cannot
 * tell).  Only a positive "this API listed its models and yours is missing"
 * blocks a run; an unknown or unreachable API must not lock the UI, because
 * a stale probe result is not a reason to refuse work that might succeed.
 */
export function pulseModelUnavailableReason(
  compatibility: PulseApiCompatibility,
  modelId: string,
): string | null {
  if (compatibility.state === 'unreachable') {
    return 'シミュレーションAPIに接続できません。サーバーが起動していないか、通信が遮断されています。設定の問題ではありません。'
  }
  if (compatibility.state !== 'ready') {
    return null
  }
  return compatibility.supportedModels.has(modelId)
    ? null
    : 'このモデルは接続中のAPIが対応していません。フロントエンドより古いバージョンのサーバーが動いています。サーバーを再デプロイすると解消します（設定を変えても直りません）。'
}
