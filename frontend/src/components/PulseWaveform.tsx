import type { PulseWaveformPoint } from '../types/pulse'
import './PulseWaveform.css'

type PulseWaveformProps = {
  points: PulseWaveformPoint[]
  pulseDurationUs: number
  totalSimulationTimeUs: number
}

const WIDTH = 760
const HEIGHT = 260
const PAD_X = 54
const PAD_Y = 30

export function PulseWaveform({
  points,
  pulseDurationUs,
  totalSimulationTimeUs,
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

  return (
    <section className="pulse-waveform" aria-labelledby="pulse-waveform-title">
      <div className="pulse-waveform__heading">
        <div>
          <span>制御エンベロープ</span>
          <h2 id="pulse-waveform-title">駆動波形</h2>
        </div>
        <div className="pulse-waveform__legend">
          <span data-series="x">Ω x</span>
          <span data-series="y">Ω y</span>
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
        <text x={pulseBoundary} y={HEIGHT - 7} textAnchor="middle">Pulse終了</text>
        <text x={WIDTH - PAD_X} y={HEIGHT - 7} textAnchor="end">{chartDurationUs.toPrecision(3)} us</text>
        <text x={8} y={18}>rad/us</text>
      </svg>
      {totalSimulationTimeUs > pulseDurationUs ? (
        <p>Pulse境界以降は制御がゼロになり、状態はアイドル観測を通じて発展を続けます。</p>
      ) : null}
    </section>
  )
}
