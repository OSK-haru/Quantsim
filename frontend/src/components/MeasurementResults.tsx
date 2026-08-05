import './MeasurementResults.css'
import type { MeasurementResult } from '../types/simulation'
import { basisLabels } from '../utils/outputProbabilities'

type MeasurementResultsProps = {
  measurement: MeasurementResult
  qubitCount: number
}

export function MeasurementResults({
  measurement,
  qubitCount,
}: MeasurementResultsProps) {
  const labels = basisLabels(qubitCount)
  const measuredQubits = measurement.explicit_measurement_targets
    .map((target) => `q${target}`)
    .join(', ')

  return (
    <section className="measurement-results" aria-labelledby="measurement-results-title">
      <header className="measurement-results__heading">
        <div>
          <span className="measurement-results__eyebrow">Computational-basis readout</span>
          <h2 id="measurement-results-title">shots測定結果</h2>
        </div>
        <div className="measurement-results__meta" aria-label="測定設定">
          <span>{measurement.shots.toLocaleString()} shots</span>
          <span>seed {measurement.seed}</span>
        </div>
      </header>

      <p className="measurement-results__note">
        最終密度行列の確率分布から、seedを固定して標本化した有限回測定です。
        {measurement.classical_register_bits > 0
          ? ` 古典レジスタ ${measurement.classical_register_bits} bit の配置情報を保持しています。`
          : ''}
        {measurement.explicit_measurement_count > 0
          ? ` 回路中のMゲート ${measurement.explicit_measurement_count}個（${measuredQubits}）は、結果を捨てる非選択測定として状態へ反映されています。`
          : ' 回路中に明示的なMゲートはありません。'}
      </p>

      <div className="measurement-results__table" role="table" aria-label="shots測定カウント">
        {labels.map((state) => {
          const count = measurement.counts[state] ?? 0
          const frequency = measurement.frequencies[state]
            ?? count / Math.max(measurement.shots, 1)
          const normalizedFrequency = Math.max(0, Math.min(frequency, 1))
          return (
            <div className="measurement-results__row" role="row" key={state}>
              <code role="rowheader">{state}</code>
              <span className="measurement-results__bar" aria-hidden="true">
                <span
                  className="measurement-results__fill"
                  style={{ width: `${normalizedFrequency * 100}%` }}
                />
              </span>
              <strong role="cell">{count.toLocaleString()}</strong>
              <span role="cell">{(normalizedFrequency * 100).toFixed(2)}%</span>
            </div>
          )
        })}
      </div>

      {!measurement.classical_conditioning_supported ? (
        <p className="measurement-results__constraint">
          現在は測定結果による条件付きゲートには未対応です。
        </p>
      ) : null}
      {measurement.classical_conditioning_supported && measurement.conditional_operations?.length ? (
        <div className="measurement-results__constraint">
          条件付きゲート:{' '}
          {measurement.conditional_operations.map((operation, index) => (
            <span key={`${operation.column_index}-${operation.gate}-${operation.targets.join('-')}`}>
              {index > 0 ? ' / ' : ''}{operation.gate}[{operation.conditions.map((condition) => `c${condition.bit}=${condition.value}`).join(',')}]
            </span>
          ))}
        </div>
      ) : null}
      {measurement.classical_branches.length > 0 && measurement.branch_probability_normalized === false ? (
        <p className="measurement-results__constraint">ブランチ確率の合計が 1 ではないため、転送指標には使用していません。</p>
      ) : null}
      {measurement.classical_conditioning_supported && !measurement.classical_branching_noise_applied ? (
        <p className="measurement-results__constraint">
          条件付きゲートは論理分岐として実行されています。環境ノイズの分岐別適用は監査中です。
        </p>
      ) : null}
      {measurement.classical_branches.length > 0 ? (
        <div className="measurement-results__branches">
          <div className="measurement-results__subheading">
            <h3>古典分岐</h3>
            <span>{measurement.classical_branch_count} branches</span>
          </div>
          <div className="measurement-results__branch-table" role="table" aria-label="古典分岐一覧">
            {measurement.classical_branches.map((branch, index) => (
              <div className="measurement-results__branch-row" role="row" key={`${index}-${branch.classical_bits.join('')}`}>
                <span>#{index + 1}</span>
                <code>c={branch.classical_bits.join('')}</code>
                <span>{(branch.probability * 100).toFixed(2)}%</span>
                <span>{branch.measurements.length} measurements</span>
              </div>
            ))}
          </div>
          {measurement.classical_shot_preview.length > 0 ? (
            <div className="measurement-results__preview">
              <div className="measurement-results__subheading">
                <h3>ショット履歴プレビュー</h3>
                <span>先頭 {measurement.classical_shot_preview.length} shots</span>
              </div>
              <div className="measurement-results__shot-list">
                {measurement.classical_shot_preview.map((shot) => (
                  <span key={shot.shot_index} className="measurement-results__shot-chip">
                    #{shot.shot_index + 1} c={shot.classical_bits.join('') || '-'}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
