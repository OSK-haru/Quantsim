import type { PulseWaveformPoint } from '../types/pulse'
import './PulseWaveform.css'

type PulseWaveformProps = {
  points: PulseWaveformPoint[]
  pulseDurationUs: number
  totalSimulationTimeUs: number
  scopeLabel?: string
  /** 2準位には漏れ準位がなく、DRAGの直交成分そのものが定義されない。 */
  dragAvailable?: boolean
}

const WIDTH = 760
const HEIGHT = 260
const PAD_X = 54
const PAD_Y = 30

export function PulseWaveform({
  points,
  pulseDurationUs,
  totalSimulationTimeUs,
  scopeLabel = '単一 Pulse の波形',
  dragAvailable = true,
}: PulseWaveformProps) {
  const chartDurationUs = Math.max(
    totalSimulationTimeUs,
    pulseDurationUs,
    1e-12,
  )
  const maximum = Math.max(
    1e-12,
    ...points.flatMap((point) => [Math.abs(point.omegaX), Math.abs(point.omegaY)]),
  )
  const x = (time: number) =>
    PAD_X + (time / chartDurationUs) * (WIDTH - 2 * PAD_X)
  const y = (value: number) =>
    HEIGHT / 2 - (value / maximum) * (HEIGHT / 2 - PAD_Y)
  const path = (key: 'omegaX' | 'omegaY') =>
    points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.timeUs)} ${y(point[key])}`)
      .join(' ')
  const pulseBoundary = x(pulseDurationUs)
  /*
    パルス列が観測時間以上のとき、境界線はチャート右端に重なり、
    「Pulse終了」ラベルが右端の時刻ラベルと同じ位置で潰れる（初期表示で発生）。
    その場合は境界線だけ残し、重複するテキストは出さない。
    右端から十分内側にあるときだけラベルを描く。
  */
  const boundaryNearRightEdge = pulseBoundary >= WIDTH - PAD_X - 48
  const showBoundaryLabel = pulseDurationUs < chartDurationUs && !boundaryNearRightEdge
  /*
    Ωy が全時刻ゼロなのは「描画が抜けている」ようにも読めてしまう。
    2準位で DRAG が定義されない場合と、単に β=0 や位相0で今回たまたま
    ゼロな場合を区別して、平坦な理由を凡例のすぐ横に書く。
  */
  const quadratureIsFlat = points.every((point) => point.omegaY === 0)

  return (
    <section className="pulse-waveform" aria-labelledby="pulse-waveform-title">
      <div className="pulse-waveform__heading">
        <div>
          <span>{scopeLabel}</span>
          <h2 id="pulse-waveform-title">駆動波形</h2>
        </div>
        <div className="pulse-waveform__legend">
          <span data-series="x">Ω x（同相 I）</span>
          <span data-series="y">Ω y（直交 Q）</span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Pulseのx・y直交位相波形(rad/us)"
      >
        <line className="pulse-waveform__axis" x1={PAD_X} x2={WIDTH - PAD_X} y1={HEIGHT / 2} y2={HEIGHT / 2} />
        <line className="pulse-waveform__axis" x1={PAD_X} x2={PAD_X} y1={PAD_Y} y2={HEIGHT - PAD_Y} />
        <line className="pulse-waveform__boundary" x1={pulseBoundary} x2={pulseBoundary} y1={PAD_Y} y2={HEIGHT - PAD_Y} />
        <path className="pulse-waveform__line pulse-waveform__line--x" d={path('omegaX')} />
        <path className="pulse-waveform__line pulse-waveform__line--y" d={path('omegaY')} />
        <text x={PAD_X} y={HEIGHT - 7}>0</text>
        {showBoundaryLabel ? (
          <text x={pulseBoundary} y={HEIGHT - 7} textAnchor="middle">Pulse終了</text>
        ) : null}
        <text x={WIDTH - PAD_X} y={HEIGHT - 7} textAnchor="end">{chartDurationUs.toPrecision(3)} us</text>
        <text x={8} y={18}>rad/us</text>
      </svg>
      {quadratureIsFlat ? (
        <p className="pulse-waveform__quadrature-note">
          {dragAvailable
            ? 'Ω y は全時刻ゼロです。DRAG β = 0（または位相 0）のため直交成分が生じていません。βを与えるとガウシアンの微分波形が現れます。'
            : '2準位モデルには漏れ準位 |2⟩ がないため、その漏れを打ち消すDRAG補正自体が定義されません。したがって直交成分 Ω y は常にゼロで、駆動はガウシアン1本のみです。3準位 qutrit に切り替えるとDRAGを設計できます。'}
        </p>
      ) : null}
      {totalSimulationTimeUs > pulseDurationUs ? (
        <p>Pulse境界以降は制御がゼロになり、状態はアイドル観測を通じて発展を続けます。</p>
      ) : null}
    </section>
  )
}
