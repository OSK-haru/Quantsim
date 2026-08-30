import { useRef, useState, type ChangeEvent } from 'react'
import './CircuitConfigPreview.css'
import { ResultDrawer } from './ResultDrawer'
import type { CircuitEditorState } from '../types/circuit'
import { circuitEditorStateToConfig } from '../utils/circuitConfig'
import { exportCircuitConfigBundleJson } from '../utils/circuitConfigTransfer'
import { useInternalInfoVisible } from '../context/useAdminMode'

type CircuitConfigPreviewProps = {
  circuit: CircuitEditorState
  onImportCircuitConfig: (file: File) => Promise<string>
  defaultOpen?: boolean
  showTransferActions?: boolean
}

const PREVIEW_NOTE =
  'プレビューのみです。シミュレーション実行時は、エディターに表示されている編集後の回路を使用します。'

export function CircuitConfigPreview({
  circuit,
  onImportCircuitConfig,
  defaultOpen = false,
  showTransferActions = true,
}: CircuitConfigPreviewProps) {
  const internalInfoVisible = useInternalInfoVisible()
  const previewJson = JSON.stringify(circuitEditorStateToConfig(circuit), null, 2)
  const [copyStatus, setCopyStatus] = useState<{
    status: 'idle' | 'copied' | 'failed'
    json: string
  }>({ status: 'idle', json: '' })
  const [transferStatus, setTransferStatus] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const visibleCopyStatus = copyStatus.json === previewJson ? copyStatus.status : 'idle'

  async function handleCopyJson() {
    try {
      await navigator.clipboard.writeText(previewJson)
      setCopyStatus({ status: 'copied', json: previewJson })
    } catch {
      setCopyStatus({ status: 'failed', json: previewJson })
    }
  }

  function handleExportJson() {
    const json = exportCircuitConfigBundleJson(circuit)
    const blob = new Blob([json], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = '回路データ.json'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0)
    setTransferStatus('回路データを書き出しました')
  }

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    try {
      const message = await onImportCircuitConfig(file)
      setTransferStatus(message)
    } catch (error) {
      /* 解析失敗の本文には内部のフィールド名が並ぶので、通常は伏せる。 */
      setTransferStatus(
        internalInfoVisible && error instanceof Error
          ? error.message
          : '回路データを読み込めませんでした。ファイルの形式を確認してください。',
      )
    }
  }

  return (
    <ResultDrawer
      eyebrow="エディター"
      title={internalInfoVisible ? 'CircuitConfig のプレビュー' : '回路データ'}
      icon="braces"
      description={
        internalInfoVisible
          ? '変換された回路状態を API 互換の JSON として表示します。'
          : '編集中の回路を、保存・受け渡しできる形にまとめたものです。'
      }
      defaultOpen={defaultOpen}
    >
      <div className="circuit-config-preview">
        <p className="circuit-config-preview__note">{PREVIEW_NOTE}</p>

        {showTransferActions ? (
          <div className="circuit-config-preview__actions">
            <button
              className="circuit-config-preview__copy"
              type="button"
              onClick={handleExportJson}
            >
              回路を書き出す
            </button>
            {/* 生データのコピーは内部表現の持ち出しなので詳細モードのみ。 */}
            {internalInfoVisible ? (
              <button
                className="circuit-config-preview__copy"
                type="button"
                onClick={handleCopyJson}
              >
                JSON をコピー
              </button>
            ) : null}
            <button className="circuit-config-preview__copy" type="button" onClick={openFilePicker}>
              回路を読み込む
            </button>
            <span className="circuit-config-preview__status" aria-live="polite">
              {transferStatus || (visibleCopyStatus === 'copied' ? 'コピーしました' : visibleCopyStatus === 'failed' ? 'コピーに失敗しました' : ' ')}
            </span>
          </div>
        ) : internalInfoVisible ? (
          <div className="circuit-config-preview__actions">
            <button
              className="circuit-config-preview__copy circuit-config-preview__copy--inline"
              type="button"
              onClick={handleCopyJson}
            >
              JSON をコピー
            </button>
            <span className="circuit-config-preview__status" aria-live="polite">
              {visibleCopyStatus === 'copied' ? 'コピーしました' : visibleCopyStatus === 'failed' ? 'コピーに失敗しました' : ' '}
            </span>
          </div>
        ) : null}

        {showTransferActions ? (
          <input
            ref={fileInputRef}
            className="circuit-config-preview__file-input"
            type="file"
            accept=".json,.qscope.json,application/json"
            aria-label="回路データを読み込む"
            onChange={handleFileChange}
          />
        ) : null}

        {/* 内部フィールド名がそのまま並ぶため、生の JSON は詳細モードのみ。 */}
        {internalInfoVisible ? (
          <pre className="circuit-config-preview__json" aria-label="回路設定 JSON">
            {previewJson}
          </pre>
        ) : (
          <p className="circuit-config-preview__summary">
            量子ビット {circuit.logical_qubits} 本 / {circuit.columns.length} 列の回路です。
            書き出したファイルは、そのままこの画面から読み込み直せます。
          </p>
        )}
      </div>
    </ResultDrawer>
  )
}
