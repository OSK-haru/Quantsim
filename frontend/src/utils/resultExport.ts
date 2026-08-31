/*
 * 実行結果の書き出し。
 *
 * 回路データ（circuitConfigTransfer.ts）が「これから実行するもの」を持ち出す
 * のに対し、こちらは「実行し終えたもの」を持ち出す。授業で配る、人に渡す、
 * あとで読み直す、といった用途を想定している。
 *
 * 読み込み（インポート）は用意していない。結果を読み込めるようにすると、
 * 画面に出ている図が「いまの設定で計算したもの」なのか「ファイルから来た
 * もの」なのか区別できなくなる。結果を再現したい側は、同梱してある設定と
 * 回路を見て同じ条件で実行し直す——という一方向にしてある。
 *
 * そのため書き出しには、結果そのものだけでなく **その結果を生んだ入力一式**
 * を必ず同梱する。入力の無い結果は、後から見ても何の条件の話か分からない。
 */

import type { PulseRunRecord } from '../types/pulse'
import type { PulseCircuitState } from '../types/pulseCircuit'
import type { GateDurationDefaults, SimulationResponse } from '../types/simulation'
import type { CircuitConfig } from './circuitConfig'

export const GATE_AWARE_RESULT_KIND = 'quantscope_gate_aware_result'
export const PULSE_RESULT_KIND = 'quantscope_pulse_result'

/*
 * 生成元を書き残しておく。結果ファイルだけが手元に残ったときに、どの
 * アプリのどの形式かが分からないと読みようがない。
 */
const GENERATOR = 'Yuragi-Strider'

export type ResultExportMeta = {
  generator: typeof GENERATOR
  /* 書き出した時刻（ISO 8601, UTC）。実行時刻とは別物。 */
  exported_at: string
}

export type GateAwareResultBundle = {
  version: 1
  kind: typeof GATE_AWARE_RESULT_KIND
  meta: ResultExportMeta
  /* この結果を生んだ入力。これが無いと結果を読み解けない。 */
  inputs: {
    circuit_config: CircuitConfig | null
    gate_duration_defaults: GateDurationDefaults
  }
  result: SimulationResponse
}

export type PulseResultBundle = {
  version: 1
  kind: typeof PULSE_RESULT_KIND
  meta: ResultExportMeta
  inputs: {
    pulse_circuit: PulseCircuitState
    /* 実行時点のPulseラボ設定。実行後に画面で変えた値ではない。 */
    lab_form: PulseRunRecord['formAtRun']
  }
  run: {
    completed_at: string
    /*
     * 実行条件の指紋。同じ signature の結果どうしは同じ条件で計算されて
     * いる。ファイルを2つ並べたときの照合に使える。
     */
    signature: string
  }
  result: PulseRunRecord['response']
}

function createMeta(now: Date): ResultExportMeta {
  return {
    generator: GENERATOR,
    exported_at: now.toISOString(),
  }
}

export function buildGateAwareResultBundle(
  response: SimulationResponse,
  circuitConfig: CircuitConfig | null,
  gateDurationDefaults: GateDurationDefaults,
  now: Date = new Date(),
): GateAwareResultBundle {
  return {
    version: 1,
    kind: GATE_AWARE_RESULT_KIND,
    meta: createMeta(now),
    inputs: {
      circuit_config: circuitConfig,
      gate_duration_defaults: gateDurationDefaults,
    },
    result: response,
  }
}

export function buildPulseResultBundle(
  record: PulseRunRecord,
  circuit: PulseCircuitState,
  now: Date = new Date(),
): PulseResultBundle {
  return {
    version: 1,
    kind: PULSE_RESULT_KIND,
    meta: createMeta(now),
    inputs: {
      pulse_circuit: circuit,
      lab_form: record.formAtRun,
    },
    run: {
      completed_at: record.completedAt,
      signature: record.signature,
    },
    result: record.response,
  }
}

/*
 * ファイル名に実行時刻を入れる。条件を変えて何度も書き出す使い方なので、
 * 「(1)」「(2)」が並ぶより、いつの実行かが名前で分かるほうがよい。
 * コロンはWindowsのファイル名に使えないため、日付と時刻を数字だけにする。
 */
export function resultFileName(prefix: string, timestamp: string): string {
  const parsed = new Date(timestamp)
  const stamp = Number.isNaN(parsed.getTime())
    ? 'unknown'
    : [
        parsed.getFullYear(),
        String(parsed.getMonth() + 1).padStart(2, '0'),
        String(parsed.getDate()).padStart(2, '0'),
        '-',
        String(parsed.getHours()).padStart(2, '0'),
        String(parsed.getMinutes()).padStart(2, '0'),
        String(parsed.getSeconds()).padStart(2, '0'),
      ].join('')
  return `${prefix}_${stamp}.json`
}

/*
 * Blob を作ってダウンロードさせるところまで。回路データの書き出しと同じ
 * 手順だが、こちらはファイル名を呼び出し側から渡す。
 */
export function downloadJson(json: string, fileName: string) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  /*
   * click() が非同期に処理されることがあるので、revoke は次のタスクへ回す。
   * 同期的に呼ぶと、ダウンロードが始まる前にURLが無効になる場合がある。
   */
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0)
}
