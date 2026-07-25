import { useRef, useState, type ChangeEvent } from 'react'
import './CircuitConfigPreview.css'
import { ResultDrawer } from './ResultDrawer'
import type { CircuitEditorState } from '../types/circuit'
import { circuitEditorStateToConfig } from '../utils/circuitConfig'
import { exportCircuitConfigBundleJson } from '../utils/circuitConfigTransfer'

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
    anchor.download = 'quantscope-circuit.qscope.json'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0)
    setTransferStatus('JSON をエクスポートしました')
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
      setTransferStatus(error instanceof Error ? error.message : 'インポートに失敗しました。')
    }
  }

  return (
    <ResultDrawer
      eyebrow="エディター"
      title="CircuitConfig のプレビュー"
      icon="braces"
      description="変換された回路状態を API 互換の JSON として表示します。"
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
              JSON をエクスポート
            </button>
            <button
              className="circuit-config-preview__copy"
              type="button"
              onClick={handleCopyJson}
            >
              JSON をコピー
            </button>
            <button className="circuit-config-preview__copy" type="button" onClick={openFilePicker}>
              JSON をインポート
            </button>
            <span className="circuit-config-preview__status" aria-live="polite">
              {transferStatus || (visibleCopyStatus === 'copied' ? 'コピーしました' : visibleCopyStatus === 'failed' ? 'コピーに失敗しました' : ' ')}
            </span>
          </div>
        ) : (
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
        )}

        {showTransferActions ? (
          <input
            ref={fileInputRef}
            className="circuit-config-preview__file-input"
            type="file"
            accept=".json,.qscope.json,application/json"
            aria-label="回路設定 JSON をインポート"
            onChange={handleFileChange}
          />
        ) : null}

        <pre className="circuit-config-preview__json" aria-label="回路設定 JSON">
          {previewJson}
        </pre>
      </div>
    </ResultDrawer>
  )
}
