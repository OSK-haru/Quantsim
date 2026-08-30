import './DiagnosticsCard.css'
import { ResultDrawer } from './ResultDrawer'
import { useInternalInfoVisible } from '../context/useAdminMode'
import { getModelLabel } from '../utils/modelLabels'
import type { SimulationDiagnostics, SimulationRates } from '../types/simulation'

export type { SimulationDiagnostics } from '../types/simulation'

type DiagnosticsCardProps = {
  diagnostics: SimulationDiagnostics
  rates: SimulationRates
}

/* 内部 ID は詳細モードでのみ添える。 */
function ModelValue({ id, showId }: { id: string; showId: boolean }) {
  const info = getModelLabel(id)

  return (
    <strong className="diagnostics-value">
      <span>{info.label}</span>
      {showId ? <span className="diagnostics-value__id">{info.id}</span> : null}
    </strong>
  )
}

type PerformanceField = {
  label: string
  key: keyof SimulationDiagnostics
  format?: (value: unknown) => string
}

const PERFORMANCE_FIELDS: PerformanceField[] = [
  { label: 'API total request', key: 'api_total_request_ms', format: formatMilliseconds },
  { label: 'API build config', key: 'api_build_config_ms', format: formatMilliseconds },
  { label: 'API run simulation', key: 'api_run_simulation_ms', format: formatMilliseconds },
  { label: 'API UI response', key: 'api_ui_response_ms', format: formatMilliseconds },
  { label: 'Logical qubits', key: 'api_logical_qubits', format: formatInteger },
  { label: 'Circuit columns', key: 'api_circuit_column_count', format: formatInteger },
  { label: 'Circuit gates', key: 'api_circuit_gate_count', format: formatInteger },
  { label: 'Time steps', key: 'api_time_steps', format: formatInteger },
  { label: 'Duration', key: 'api_duration_us', format: formatMicroseconds },
  { label: 'RK4 substeps', key: 'total_rk4_substeps', format: formatInteger },
  { label: 'RHS evaluations', key: 'total_rhs_evaluations', format: formatInteger },
  { label: 'Gate segments', key: 'gate_segment_count', format: formatInteger },
  { label: 'Idle segments', key: 'idle_segment_count', format: formatInteger },
  { label: 'Actual duration', key: 'actual_duration_us', format: formatMicroseconds },
]

const CORE_PROFILING_FIELDS: PerformanceField[] = [
  { label: 'Core dimension', key: 'core_dimension', format: formatInteger },
  { label: 'Density matrix shape', key: 'core_density_matrix_shape' },
  { label: 'Core segments', key: 'core_segments_count', format: formatInteger },
  { label: 'Core idle segments', key: 'core_idle_segments_count', format: formatInteger },
  { label: 'Core gate segments', key: 'core_gate_segments_count', format: formatInteger },
  { label: 'Total segment duration', key: 'core_total_segment_duration_us', format: formatMicroseconds },
  { label: 'Total idle duration', key: 'core_total_idle_duration_us', format: formatMicroseconds },
  { label: 'Total gate duration', key: 'core_total_gate_duration_us', format: formatMicroseconds },
  { label: 'Core time steps', key: 'core_time_steps', format: formatInteger },
  { label: 'Core RK4 substeps', key: 'core_total_rk4_substeps', format: formatInteger },
  { label: 'Core RHS evaluations', key: 'core_total_rhs_evaluations', format: formatInteger },
  { label: 'Collapse operators', key: 'core_collapse_operator_count', format: formatInteger },
  { label: 'Lindblad build', key: 'core_lindblad_operator_build_ms', format: formatMilliseconds },
  { label: 'Segment setup', key: 'core_segment_setup_ms', format: formatMilliseconds },
  { label: 'Idle evolution', key: 'core_idle_evolution_ms', format: formatMilliseconds },
  { label: 'Gate evolution', key: 'core_gate_evolution_ms', format: formatMilliseconds },
  { label: 'Total evolution', key: 'core_total_evolution_ms', format: formatMilliseconds },
  { label: 'Output probabilities', key: 'core_output_probabilities_ms', format: formatMilliseconds },
  { label: 'Diagnostics build', key: 'core_diagnostics_build_ms', format: formatMilliseconds },
  { label: 'Dense engine', key: 'core_dense_execution_engine' },
  { label: 'Zero-H fast path', key: 'core_zero_hamiltonian_fast_path_used', format: formatBoolean },
  { label: 'Idle only', key: 'core_idle_only', format: formatBoolean },
  { label: 'Has gate segments', key: 'core_has_gate_segments', format: formatBoolean },
  { label: 'Has idle after circuit', key: 'core_has_idle_after_circuit', format: formatBoolean },
]

const INTERNAL_PROFILING_FIELDS: PerformanceField[] = [
  { label: 'RK4 steps', key: 'core_profile_rk4_step_count', format: formatInteger },
  { label: 'RK4 total', key: 'core_profile_rk4_total_ms', format: formatMilliseconds },
  { label: 'RK4 average', key: 'core_profile_rk4_average_ms', format: formatMilliseconds },
  { label: 'RHS calls', key: 'core_profile_rhs_call_count', format: formatInteger },
  { label: 'RHS total', key: 'core_profile_rhs_total_ms', format: formatMilliseconds },
  { label: 'RHS average', key: 'core_profile_rhs_average_ms', format: formatMilliseconds },
  { label: 'Hamiltonian term', key: 'core_profile_hamiltonian_term_ms', format: formatMilliseconds },
  { label: 'Dissipator total', key: 'core_profile_dissipator_total_ms', format: formatMilliseconds },
  { label: 'Matrix accumulation', key: 'core_profile_matrix_accumulation_ms', format: formatMilliseconds },
  { label: 'Dissipator operator iterations', key: 'core_profile_dissipator_operator_iterations', format: formatInteger },
  { label: 'Dissipator / operator', key: 'core_profile_dissipator_average_per_operator_ms', format: formatMilliseconds },
  { label: 'Matmul calls', key: 'core_profile_matmul_call_count', format: formatInteger },
  { label: 'Matmul total', key: 'core_profile_matmul_total_ms', format: formatMilliseconds },
  { label: 'Matmul average', key: 'core_profile_matmul_average_ms', format: formatMilliseconds },
  { label: 'Python matmul calls', key: 'core_profile_python_matmul_call_count', format: formatInteger },
  { label: 'Python matmul total', key: 'core_profile_python_matmul_total_ms', format: formatMilliseconds },
  { label: 'NumPy matmul calls', key: 'core_profile_numpy_matmul_call_count', format: formatInteger },
  { label: 'NumPy matmul total', key: 'core_profile_numpy_matmul_total_ms', format: formatMilliseconds },
  { label: 'Adjoint calls', key: 'core_profile_adjoint_call_count', format: formatInteger },
  { label: 'Adjoint total', key: 'core_profile_adjoint_total_ms', format: formatMilliseconds },
  { label: 'Add/scale calls', key: 'core_profile_matrix_add_scale_call_count', format: formatInteger },
  { label: 'Add/scale total', key: 'core_profile_matrix_add_scale_total_ms', format: formatMilliseconds },
  { label: 'Conversions', key: 'core_profile_conversion_count', format: formatInteger },
  { label: 'Conversion total', key: 'core_profile_conversion_total_ms', format: formatMilliseconds },
  { label: 'Zero-H skips', key: 'core_profile_zero_hamiltonian_skip_count', format: formatInteger },
  { label: 'L dagger build count', key: 'core_profile_collapse_adjoint_build_count', format: formatInteger },
  { label: 'L dagger build time', key: 'core_profile_collapse_adjoint_build_ms', format: formatMilliseconds },
  { label: 'L dagger L build count', key: 'core_profile_ldagger_l_build_count', format: formatInteger },
  { label: 'L dagger L build time', key: 'core_profile_ldagger_l_build_ms', format: formatMilliseconds },
]

export function DiagnosticsCard({ diagnostics, rates }: DiagnosticsCardProps) {
  const internalInfoVisible = useInternalInfoVisible()

  const rateRows = [
    { label: '下降レート', value: rates.gamma_down_per_us, format: formatRate },
    { label: '上昇レート', value: rates.gamma_up_per_us, format: formatRate },
    {
      label: '占有数緩和レート',
      value: rates.gamma_population_relaxation_per_us,
      format: formatRate,
    },
    { label: '純位相緩和レート', value: rates.gamma_phi_per_us, format: formatRate },
    { label: '基準 T1', value: rates.t1_base_us, format: formatMicroseconds },
    { label: '実効 T1', value: rates.t1_effective_us, format: formatMicroseconds },
  ].filter((row) => row.value !== null)

  const performanceRows = PERFORMANCE_FIELDS
    .map((field) => {
      const value = diagnostics[field.key]
      if (value === undefined || value === null) {
        return null
      }

      return {
        label: field.label,
        value: field.format ? field.format(value) : String(value),
      }
    })
    .filter((entry): entry is { label: string; value: string } => entry !== null)

  const coreProfilingRows = CORE_PROFILING_FIELDS
    .map((field) => {
      const value = diagnostics[field.key]
      if (value === undefined || value === null) {
        return null
      }

      return {
        label: field.label,
        value: field.format ? field.format(value) : String(value),
      }
    })
    .filter((entry): entry is { label: string; value: string } => entry !== null)

  const internalProfilingRows = internalInfoVisible
    && diagnostics.core_internal_profiling_enabled === true
    ? INTERNAL_PROFILING_FIELDS
        .map((field) => {
          const value = diagnostics[field.key]
          if (value === undefined || value === null) {
            return null
          }

          return {
            label: field.label,
            value: field.format ? field.format(value) : String(value),
          }
        })
        .filter((entry): entry is { label: string; value: string } => entry !== null)
    : []

  return (
    <ResultDrawer
      eyebrow="診断情報"
      title={internalInfoVisible ? '実行時スナップショット' : '計算条件の詳細'}
      icon="wrench"
      description={
        internalInfoVisible
          ? '最新の応答に関するバックエンドと実行時の詳細です。'
          : '直近の計算に使われた物理モデルと環境レートです。'
      }
      defaultOpen={false}
    >
      <div className="diagnostics-grid">
        <div className="diagnostics-item">
          <span className="diagnostics-label">シミュレーションモデル</span>
          <ModelValue id={diagnostics.simulation_model} showId={internalInfoVisible} />
        </div>
        <div className="diagnostics-item">
          <span className="diagnostics-label">発展モード</span>
          <ModelValue id={diagnostics.evolution_mode} showId={internalInfoVisible} />
        </div>
        {/* ここから下は実行基盤の内部情報なので、詳細モードのみ。 */}
        {internalInfoVisible ? (
          <>
            {/* ゲートを考慮した発展の内訳。実コードと突き合わせたい人向け。 */}
            {diagnostics.hamiltonian_mode ? (
              <div className="diagnostics-item">
                <span className="diagnostics-label">ハミルトニアン構成</span>
                <ModelValue id={String(diagnostics.hamiltonian_mode)} showId />
              </div>
            ) : null}
            {diagnostics.simulation_mode ? (
              <div className="diagnostics-item">
                <span className="diagnostics-label">実行時モード</span>
                <ModelValue id={String(diagnostics.simulation_mode)} showId />
              </div>
            ) : null}
            {diagnostics.compilation_mode ? (
              <div className="diagnostics-item">
                <span className="diagnostics-label">コンパイル方式</span>
                <strong className="diagnostics-value">
                  {String(diagnostics.compilation_mode)}
                </strong>
              </div>
            ) : null}
            {diagnostics.gate_duration_model ? (
              <div className="diagnostics-item">
                <span className="diagnostics-label">ゲート時間モデル</span>
                <strong className="diagnostics-value">
                  {String(diagnostics.gate_duration_model)}
                </strong>
              </div>
            ) : null}
            <div className="diagnostics-item">
              <span className="diagnostics-label">シミュレーションバックエンド</span>
              <ModelValue id={diagnostics.simulation_backend} showId />
            </div>
            <div className="diagnostics-item">
              <span className="diagnostics-label">バックエンド名</span>
              <ModelValue id={diagnostics.backend_name} showId />
            </div>
            <div className="diagnostics-item">
              <span className="diagnostics-label">Rust カーネルモード</span>
              <strong className="diagnostics-value">{diagnostics.rust_kernel_mode}</strong>
            </div>
            <div className="diagnostics-item">
              <span className="diagnostics-label">Rust 呼び出し回数</span>
              <strong className="diagnostics-value">{diagnostics.rust_kernel_call_count}</strong>
            </div>
            <div className="diagnostics-item">
              <span className="diagnostics-label">サンプルバッチ数</span>
              <strong className="diagnostics-value">
                {diagnostics.rust_kernel_sampled_batch_count}
              </strong>
            </div>
          </>
        ) : null}
      </div>

      {internalInfoVisible ? (
        <div className="diagnostics-badges">
          <span className={`diagnostics-badge ${diagnostics.backend_fallback_used ? 'is-warn' : 'is-ok'}`}>
            {diagnostics.backend_fallback_used ? 'バックエンドフォールバック' : 'フォールバックなし'}
          </span>
          <span className={`diagnostics-badge ${diagnostics.rust_kernel_fallback_used ? 'is-warn' : 'is-ok'}`}>
            {diagnostics.rust_kernel_fallback_used ? 'Rust フォールバック' : 'Rust 有効'}
          </span>
        </div>
      ) : null}

      {rateRows.length > 0 ? (
        <div className="diagnostics-performance" aria-label="環境レート">
          <h4 className="diagnostics-performance__title">環境レート</h4>
          <div className="diagnostics-performance__grid">
            {rateRows.map((row) => (
              <div className="diagnostics-performance__item" key={row.label}>
                <span className="diagnostics-performance__label">{row.label}</span>
                <strong className="diagnostics-performance__value">{row.format(row.value)}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {internalInfoVisible && performanceRows.length > 0 ? (
        <div className="diagnostics-performance" aria-label="性能と時間">
          <h4 className="diagnostics-performance__title">性能 / 時間</h4>
          <div className="diagnostics-performance__grid">
            {performanceRows.map((row) => (
              <div className="diagnostics-performance__item" key={row.label}>
                <span className="diagnostics-performance__label">{row.label}</span>
                <strong className="diagnostics-performance__value">{row.value}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {internalInfoVisible && coreProfilingRows.length > 0 ? (
        <div className="diagnostics-performance" aria-label="Core プロファイリング">
          <h4 className="diagnostics-performance__title">Core プロファイリング</h4>
          <div className="diagnostics-performance__grid">
            {coreProfilingRows.map((row) => (
              <div className="diagnostics-performance__item" key={row.label}>
                <span className="diagnostics-performance__label">{row.label}</span>
                <strong className="diagnostics-performance__value">{row.value}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {internalProfilingRows.length > 0 ? (
        <div className="diagnostics-performance" aria-label="内部 Core プロファイリング">
          <h4 className="diagnostics-performance__title">内部 Core プロファイリング</h4>
          <div className="diagnostics-performance__grid">
            {internalProfilingRows.map((row) => (
              <div className="diagnostics-performance__item" key={row.label}>
                <span className="diagnostics-performance__label">{row.label}</span>
                <strong className="diagnostics-performance__value">{row.value}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </ResultDrawer>
  )
}

function formatMilliseconds(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) {
    return '利用できません'
  }
  return `${number.toFixed(3)} ms`
}

function formatInteger(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) {
    return '利用できません'
  }
  return `${Math.round(number)}`
}

function formatBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  return String(value)
}

function formatMicroseconds(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) {
    return '利用できません'
  }
  return `${number.toFixed(3)} us`
}

function formatRate(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) {
    return '利用できません'
  }
  return `${number.toExponential(3)} 1/us`
}
