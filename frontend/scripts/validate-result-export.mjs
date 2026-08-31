/*
 * 実行結果の書き出しの検証。
 *
 * 見ているのは主に「入力が結果に必ず同梱されること」。書き出したファイルは
 * 後から条件を再現するために配るものなので、結果だけが入っていて設定が
 * 欠けているファイルは、出せてしまうこと自体が不具合になる。
 */

import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exitCode = 1
    throw new Error(message)
  }
}

function readSource(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n')
}

const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'yuragi-strider-result-export-'))

try {
  const temporarySource = path.join(temporaryRoot, 'src')
  mkdirSync(path.join(temporarySource, 'utils'), { recursive: true })
  mkdirSync(path.join(temporarySource, 'types'), { recursive: true })
  writeFileSync(path.join(temporaryRoot, 'package.json'), '{"type":"commonjs"}')

  /*
   * resultExport.ts は型以外を import していないので、これ1本だけを
   * 落とせば動く。型の import は transpile で消える。
   */
  for (const relativePath of ['src/utils/resultExport.ts']) {
    const sourcePath = path.join(root, relativePath)
    const outputPath = path.join(temporaryRoot, relativePath.replace(/\.ts$/, '.js'))
    const output = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: sourcePath,
    }).outputText
    writeFileSync(outputPath, output)
  }

  const require = createRequire(import.meta.url)
  const {
    buildGateAwareResultBundle,
    buildPulseResultBundle,
    resultFileName,
    GATE_AWARE_RESULT_KIND,
    PULSE_RESULT_KIND,
  } = require(path.join(temporarySource, 'utils', 'resultExport.js'))

  /* ---- Gate-aware ---- */

  const circuitConfig = {
    logical_qubits: 2,
    initial_states: [0, 0],
    columns: [{ step: 0, gates: [{ type: 'H', targets: [0] }] }],
  }
  const gateDurationDefaults = { single_qubit_ns: 40, two_qubit_ns: 300 }
  const gateAwareResponse = {
    circuit: { qubit_count: 2 },
    parameters: { temperature_mk: 15, duration_us: 2 },
    summary: { final_fidelity: 0.87 },
    timeline: [{ time_us: 0, fidelity: 1 }],
    output_probabilities: { '00': 0.5, '11': 0.5 },
    state_snapshots: [],
    warnings: [],
    issues: [],
  }

  const fixedNow = new Date('2026-08-31T12:34:56.000Z')
  const gateBundle = buildGateAwareResultBundle(
    gateAwareResponse,
    circuitConfig,
    gateDurationDefaults,
    fixedNow,
  )

  assert(gateBundle.version === 1, 'gate-aware bundle must be version 1')
  assert(
    gateBundle.kind === GATE_AWARE_RESULT_KIND,
    'gate-aware bundle must carry its own kind',
  )
  assert(
    gateBundle.kind !== PULSE_RESULT_KIND,
    'the two modes must not share a kind, or files become indistinguishable',
  )
  assert(
    gateBundle.inputs.circuit_config === circuitConfig,
    'gate-aware bundle must embed the circuit that produced the result',
  )
  assert(
    gateBundle.inputs.gate_duration_defaults === gateDurationDefaults,
    'gate-aware bundle must embed the gate durations',
  )
  assert(gateBundle.result === gateAwareResponse, 'gate-aware bundle must embed the result')
  assert(
    gateBundle.meta.exported_at === '2026-08-31T12:34:56.000Z',
    'export time must be recorded in ISO 8601',
  )
  assert(gateBundle.meta.generator === 'Yuragi-Strider', 'generator must be recorded')

  /* 書き出したものが、そのままJSONとして往復できること。 */
  const gateRoundTrip = JSON.parse(JSON.stringify(gateBundle, null, 2))
  assert(
    gateRoundTrip.inputs.circuit_config.logical_qubits === 2,
    'gate-aware bundle must survive a JSON round trip',
  )
  assert(
    gateRoundTrip.result.output_probabilities['11'] === 0.5,
    'gate-aware probabilities must survive a JSON round trip',
  )

  /*
   * 回路が無い状態でも書き出せてしまうが、そのときは欠けていることが
   * ファイル上で分かる必要がある。黙って空オブジェクトにしない。
   */
  const noCircuitBundle = buildGateAwareResultBundle(
    gateAwareResponse,
    null,
    gateDurationDefaults,
    fixedNow,
  )
  assert(
    noCircuitBundle.inputs.circuit_config === null,
    'a missing circuit must be explicit null, not an empty object',
  )
  assert(
    'circuit_config' in JSON.parse(JSON.stringify(noCircuitBundle)).inputs,
    'a missing circuit must still appear as a key after serialisation',
  )

  /* ---- Pulse ---- */

  const pulseForm = {
    modelId: 'pulse_extension_b_qutrit_v1',
    localLevels: 3,
    dragBetaUs: 0.002,
    temperatureMk: 50,
  }
  const pulseCircuit = { transmonCount: 1, lanes: [{ blocks: [] }] }
  const pulseRecord = {
    response: {
      contract_version: 'pulse-extension-b-v1',
      model: { model_id: 'pulse_extension_b_qutrit_v1', state_levels: 3 },
      trajectory: [{ time_us: 0, population_0: 1 }],
      leakage: { maximum_recorded_leakage_probability: 0.1004 },
      warnings: [],
      limitations: [],
    },
    formAtRun: pulseForm,
    completedAt: '2026-08-31T01:02:03.000Z',
    signature: 'sig-abc',
  }

  const pulseBundle = buildPulseResultBundle(pulseRecord, pulseCircuit, fixedNow)

  assert(pulseBundle.version === 1, 'pulse bundle must be version 1')
  assert(pulseBundle.kind === PULSE_RESULT_KIND, 'pulse bundle must carry its own kind')
  assert(
    pulseBundle.inputs.lab_form === pulseForm,
    'pulse bundle must embed the settings used at run time, not the current ones',
  )
  assert(
    pulseBundle.inputs.pulse_circuit === pulseCircuit,
    'pulse bundle must embed the pulse circuit',
  )
  assert(pulseBundle.result === pulseRecord.response, 'pulse bundle must embed the result')
  assert(
    pulseBundle.run.completed_at === '2026-08-31T01:02:03.000Z',
    'pulse bundle must record when the run completed',
  )
  assert(
    pulseBundle.run.signature === 'sig-abc',
    'pulse bundle must record the run signature so two files can be checked against each other',
  )
  /* 実行時刻と書き出し時刻は別物。両方が残ること。 */
  assert(
    pulseBundle.meta.exported_at !== pulseBundle.run.completed_at,
    'export time and run time must be recorded separately',
  )

  const pulseRoundTrip = JSON.parse(JSON.stringify(pulseBundle, null, 2))
  assert(
    pulseRoundTrip.inputs.lab_form.dragBetaUs === 0.002,
    'pulse settings must survive a JSON round trip',
  )
  assert(
    pulseRoundTrip.result.leakage.maximum_recorded_leakage_probability === 0.1004,
    'pulse leakage must survive a JSON round trip',
  )

  /* ---- ファイル名 ---- */

  const name = resultFileName('pulse結果', '2026-08-31T01:02:03.000Z')
  assert(name.endsWith('.json'), 'result files must be .json')
  assert(name.startsWith('pulse結果_'), 'result file name must keep its prefix')
  /*
   * Windowsのファイル名に使えない文字が混ざっていないこと。ISO文字列を
   * そのまま使うとコロンが入り、保存に失敗する。
   */
  for (const forbidden of [':', '/', '\\', '*', '?', '"', '<', '>', '|']) {
    assert(
      !name.includes(forbidden),
      `result file name must not contain ${forbidden}, which Windows rejects`,
    )
  }
  /* 時刻が壊れていても書き出せなくならないこと。 */
  const brokenName = resultFileName('pulse結果', 'not-a-timestamp')
  assert(
    brokenName === 'pulse結果_unknown.json',
    'an unparsable timestamp must still produce a usable file name',
  )

  /* ---- 画面側の配線 ---- */

  const comparisonBarSource = readSource('src/components/RunComparisonBar.tsx')
  assert(
    comparisonBarSource.includes('onExport'),
    'the shared run bar must expose an export action',
  )

  for (const [page, builder] of [
    ['src/pages/StateExplorerPage.tsx', 'buildGateAwareResultBundle'],
    ['src/pages/PulseStateExplorerPage.tsx', 'buildPulseResultBundle'],
  ]) {
    const source = readSource(page)
    assert(source.includes(builder), `${page} must build its own bundle type`)
    assert(source.includes('onExport={exportCurrentRun}'), `${page} must wire the export action`)
  }

  /*
   * 結果の取り込みは用意していない。取り込めるようにすると、画面の図が
   * いまの設定の計算結果なのかファイル由来なのか区別できなくなる。
   * 片方向であることを、ここで固定しておく。
   */
  const exportSource = readSource('src/utils/resultExport.ts')
  assert(
    !exportSource.includes('parseResult') && !exportSource.includes('importResult'),
    'result files must stay export-only; importing them would make on-screen figures ambiguous',
  )

  console.log('Result export bundles and file names: PASS')
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}
