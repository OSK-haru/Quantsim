/*
 * ゲート／Pulseを回路へ置いた瞬間に、置いた場所から波紋が広がる演出。
 *
 * 置けたことは回路図の描き換えでも分かるが、掴んで落とす操作は視線が
 * カーソル側にあるので、変化が起きた場所と見ている場所がずれる。
 * 入ったスロットそのものを一瞬響かせて、操作と結果を結びつける。
 *
 * React コンポーネントではなく DOM への直接生成にしてあるのは、
 * 呼び出し元（回路図の SVG、Pulseタイムライン、パレットのクリック）が
 * 複数ページに散っていて、そのすべてに state と後片付けを持たせると
 * 演出のためだけの再レンダーが増えるため。要素はアニメーション終了時に
 * 自分で消える。
 */

const LAYER_ID = 'gate-placement-effect-layer'
const RING_COUNT = 3
const RING_STAGGER_MS = 90
/* いちばん遅い輪が消えきるまで（アニメーション 520ms + 遅延）。 */
const EFFECT_LIFETIME_MS = 520 + RING_STAGGER_MS * (RING_COUNT - 1)

function isEnabled(): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  /* 設定メニューの「アニメーション」。AnimationSettingsProvider が常に書いている。 */
  if (document.documentElement.dataset.animations === 'off') {
    return false
  }

  /* OS 側の「視差効果を減らす」も尊重する。 */
  return !(
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function effectLayer(): HTMLElement {
  const existing = document.getElementById(LAYER_ID)
  if (existing) {
    return existing
  }

  const layer = document.createElement('div')
  layer.id = LAYER_ID
  layer.className = 'gate-placement-effect-layer'
  layer.setAttribute('aria-hidden', 'true')
  document.body.appendChild(layer)
  return layer
}

export type GatePlacementEffectTone = 'gate' | 'pulse'

/*
 * clientX / clientY は置いたゲートの中心のビューポート座標。
 * position: fixed のレイヤーへ置くので、回路図のスクロール量や拡大率を
 * ここで考え直す必要はない（呼び出し側が測った時点の画面上の位置に出る）。
 */
export function spawnGatePlacementEffect(
  clientX: number,
  clientY: number,
  tone: GatePlacementEffectTone = 'gate',
): void {
  if (!isEnabled() || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return
  }

  const burst = document.createElement('div')
  burst.className = 'gate-placement-effect'
  burst.dataset.tone = tone
  burst.style.left = `${clientX}px`
  burst.style.top = `${clientY}px`

  const core = document.createElement('span')
  core.className = 'gate-placement-effect__core'
  burst.appendChild(core)

  /* 少しずつ遅らせて出すことで、一枚の輪ではなく「響き」に見せる。 */
  for (let index = 0; index < RING_COUNT; index += 1) {
    const ring = document.createElement('span')
    ring.className = 'gate-placement-effect__ring'
    ring.style.setProperty('--ring-delay', `${index * RING_STAGGER_MS}ms`)
    burst.appendChild(ring)
  }

  const layer = effectLayer()
  layer.appendChild(burst)

  /*
   * animationend は要素ごとに複数回上がるうえ、タブが背面だと来ないことがある。
   * 取りこぼして DOM に残り続けないよう、寿命で確実に消す。
   */
  window.setTimeout(() => burst.remove(), EFFECT_LIFETIME_MS + 120)
}
