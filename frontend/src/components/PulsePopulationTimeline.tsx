import type { PulseLabForm, PulseResponse } from '../types/pulse'
import {
  isCoupledTransmonNetworkResponse,
  isQutritPulseResponse,
} from '../types/pulse'
import { qutritTargetOverlap } from '../utils/pulseLab'
import './PulsePopulationTimeline.css'

type PulsePopulationTimelineProps = {
  response: PulseResponse
  formAtRun: PulseLabForm
  /* 状態エクスプローラーで他のパネルと共有する物理時刻。単体表示では出さない。 */
  cursorTimeUs?: number | null
}

const WIDTH = 760
const HEIGHT = 275
const PAD_X = 52
const PAD_Y = 28

export function PulsePopulationTimeline({
  response,
  formAtRun,
  cursorTimeUs = null,
}: PulsePopulationTimelineProps) {
  const points = response.trajectory
  const maximumTime = Math.max(response.sample_times_us.at(-1) ?? 1, 1e-12)
  const x = (time: number) => PAD_X + (time / maximumTime) * (WIDTH - 2 * PAD_X)
  const y = (value: number) => HEIGHT - PAD_Y - value * (HEIGHT - 2 * PAD_Y)
  const qutrit = isQutritPulseResponse(response)
  const series = isCoupledTransmonNetworkResponse(response)
    ? networkSeries(response)
    : isQutritPulseResponse(response)
      ? qutritSeries(response, formAtRun)
      : twoLevelSeries(response)
  const timeValues = points.map((point) => point.time_us)
  const availableSeries = series.filter((item) => item.values.some((value) => value !== null))
  const cursorX = cursorTimeUs === null
    ? null
    : x(Math.min(maximumTime, Math.max(0, cursorTimeUs)))

  return (
    <section className="pulse-population" aria-labelledby="pulse-population-title">
      <div className="pulse-population__heading">
        <div>
          <span>状態発展</span>
          <h2 id="pulse-population-title">占有確率と品質指標</h2>
        </div>
        <div className="pulse-population__legend">
          {availableSeries.map((item) => (
            <span key={item.label} style={{ '--series-color': item.color } as React.CSSProperties}>
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="時間に対する状態占有確率・純度・忠実度">
        {[0, 0.5, 1].map((tick) => (
          <g key={tick}>
            <line className="pulse-population__grid" x1={PAD_X} x2={WIDTH - PAD_X} y1={y(tick)} y2={y(tick)} />
            <text x={PAD_X - 10} y={y(tick) + 4} textAnchor="end">{tick.toFixed(1)}</text>
          </g>
        ))}
        <line className="pulse-population__axis" x1={PAD_X} x2={WIDTH - PAD_X} y1={HEIGHT - PAD_Y} y2={HEIGHT - PAD_Y} />
        {availableSeries.map((item) => (
          <path
            className="pulse-population__line"
            key={item.label}
            stroke={item.color}
            strokeDasharray={item.label.includes('純度') || item.label.includes('重なり') || item.label.includes('忠実度') ? '5 4' : undefined}
            d={linePath(timeValues, item.values, x, y)}
          />
        ))}
        {cursorX === null ? null : (
          <g className="pulse-population__cursor" aria-label={`現在 ${cursorTimeUs?.toFixed(4)} マイクロ秒`}>
            <line x1={cursorX} x2={cursorX} y1={PAD_Y} y2={HEIGHT - PAD_Y} />
            <circle cx={cursorX} cy={PAD_Y} r="4" />
          </g>
        )}
        <text x={PAD_X} y={HEIGHT - 6}>0</text>
        <text x={WIDTH - PAD_X} y={HEIGHT - 6} textAnchor="end">{maximumTime.toPrecision(3)} us</text>
      </svg>
      {qutrit ? (
        <p className="pulse-population__note">
          P2はリーケージ確率であり、計算部分空間の正規化によって除かれることはありません。
          目標との重なりは、共鳴する目標角度のリクエストの場合のみ表示されます。
        </p>
      ) : null}
    </section>
  )
}

function networkSeries(
  response: Extract<PulseResponse, { contract_version: 'pulse-transmon-network-v1' }>,
) {
  const count = response.model.logical_qubits
  const ground = '0'.repeat(count)
  const selectedLabels = [
    ground,
    ...Array.from({ length: count }, (_, index) => (
      `${'0'.repeat(index)}1${'0'.repeat(count - index - 1)}`
    )),
  ]
  const colors = ['#61d7c2', '#6da7ff', '#e7a9ee', '#d9c66c', '#9ed58a']
  return [
    ...selectedLabels.map((label, index) => ({
      label: `P${label}`,
      color: colors[index % colors.length],
      values: response.trajectory.map((point) => point.joint_populations[label] ?? 0),
    })),
    {
      label: 'リーケージ',
      color: '#ef8b66',
      values: response.trajectory.map((point) => point.leakage_probability),
    },
    {
      label: '純度',
      color: '#f0d878',
      values: response.trajectory.map((point) => point.purity),
    },
  ]
}

function qutritSeries(
  response: Extract<PulseResponse, { contract_version: 'pulse-extension-b-v1' }>,
  formAtRun: PulseLabForm,
) {
  const isSequence = Number(response.input.sequence_length ?? 1) > 1
  return [
    { label: 'P0', color: '#61d7c2', values: response.trajectory.map((point) => point.population_0) },
    { label: 'P1', color: '#6da7ff', values: response.trajectory.map((point) => point.population_1) },
    { label: 'P2 / リーケージ', color: '#ef8b66', values: response.trajectory.map((point) => point.population_2) },
    { label: '純度', color: '#d9c66c', values: response.trajectory.map((point) => point.purity) },
    {
      label: '目標との重なり',
      color: '#e7a9ee',
      values: response.trajectory.map((point) => (
        isSequence ? null : qutritTargetOverlap(point, formAtRun)
      )),
    },
  ]
}

function twoLevelSeries(
  response: Extract<PulseResponse, { contract_version: 'pulse-baseline-a-v1' }>,
) {
  return [
    { label: 'P0', color: '#61d7c2', values: response.trajectory.map((point) => point.open_population_0) },
    { label: 'P1', color: '#6da7ff', values: response.trajectory.map((point) => point.open_population_1) },
    { label: '純度', color: '#d9c66c', values: response.trajectory.map((point) => point.purity) },
    {
      label: '閉じた系への忠実度',
      color: '#e7a9ee',
      values: response.trajectory.map((point) => point.fidelity_to_closed),
    },
  ]
}

function linePath(
  times: number[],
  values: (number | null)[],
  x: (value: number) => number,
  y: (value: number) => number,
) {
  let started = false
  return values
    .map((value, index) => {
      if (value === null) {
        started = false
        return ''
      }
      const command = started ? 'L' : 'M'
      started = true
      return `${command} ${x(times[index])} ${y(value)}`
    })
    .join(' ')
}
