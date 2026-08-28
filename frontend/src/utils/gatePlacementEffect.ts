/*
 * ゲート／Pulseを回路へ置いた瞬間に、カーソル位置で小さく弾ける演出。
 *
 * 置けたことは回路図の描き換えでも分かるが、掴んで落とす操作は視線が
 * カーソル側にあるので、変化が起きた場所と見ている場所がずれる。
 * 落とした点そのものを一瞬光らせて、操作と結果を結びつける。
 *
 * React コンポーネントではなく DOM への直接生成にしてあるのは、
 * 呼び出し元（回路図の SVG、Pulseタイムライン、パレットのクリック）が
 * 複数ページに散っていて、そのすべてに state と後片付けを持たせると
 * 演出のためだけの再レンダーが増えるため。要素はアニメーション終了時に
 * 自分で消える。
 */

const LAYER_ID = 'gate-placement-effect-layer'
const RING_LIFETIME_MS = 460
const SPARK_COUNT = 6

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
 * clientX / clientY はビューポート座標（PointerEvent や DragEvent がそのまま持っている値）。
 * position: fixed のレイヤーへ置くので、回路図のスクロールや拡大とは無関係に
 * 「いま指していた場所」に出る。
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

  const ring = document.createElement('span')
  ring.className = 'gate-placement-effect__ring'
  burst.appendChild(ring)

  for (let index = 0; index < SPARK_COUNT; index += 1) {
    const spark = document.createElement('span')
    spark.className = 'gate-placement-effect__spark'
    /* 放射方向を等間隔に散らす。回転量だけ変えて、伸びる向きは CSS 側に任せる。 */
    spark.style.setProperty('--spark-angle', `${(360 / SPARK_COUNT) * index}deg`)
    spark.style.setProperty('--spark-delay', `${index * 12}ms`)
    burst.appendChild(spark)
  }

  const layer = effectLayer()
  layer.appendChild(burst)

  /*
   * animationend は要素ごとに複数回上がるうえ、タブが背面だと来ないことがある。
   * 取りこぼして DOM に残り続けないよう、寿命で確実に消す。
   */
  window.setTimeout(() => burst.remove(), RING_LIFETIME_MS + 120)
}
