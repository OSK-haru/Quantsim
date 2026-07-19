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
  'Preview only. Run simulation now uses the edited circuit shown in the editor.'

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
    setTransferStatus('Exported JSON')
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
      setTransferStatus(error instanceof Error ? error.message : 'Import failed.')
    }
  }

  return (
    <ResultDrawer
      eyebrow="Editor"
      title="CircuitConfig preview"
      icon="braces"
      description="Converted circuit state shown as API-compatible JSON."
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
              Export JSON
            </button>
            <button
              className="circuit-config-preview__copy"
              type="button"
              onClick={handleCopyJson}
            >
              Copy JSON
            </button>
            <button className="circuit-config-preview__copy" type="button" onClick={openFilePicker}>
              Import JSON
            </button>
            <span className="circuit-config-preview__status" aria-live="polite">
              {transferStatus || (visibleCopyStatus === 'copied' ? 'Copied' : visibleCopyStatus === 'failed' ? 'Copy failed' : ' ')}
            </span>
          </div>
        ) : (
          <div className="circuit-config-preview__actions">
            <button
              className="circuit-config-preview__copy circuit-config-preview__copy--inline"
              type="button"
              onClick={handleCopyJson}
            >
              Copy JSON
            </button>
            <span className="circuit-config-preview__status" aria-live="polite">
              {visibleCopyStatus === 'copied' ? 'Copied' : visibleCopyStatus === 'failed' ? 'Copy failed' : ' '}
            </span>
          </div>
        )}

        {showTransferActions ? (
          <input
            ref={fileInputRef}
            className="circuit-config-preview__file-input"
            type="file"
            accept=".json,.qscope.json,application/json"
            aria-label="Import circuit configuration JSON"
            onChange={handleFileChange}
          />
        ) : null}

        <pre className="circuit-config-preview__json" aria-label="Circuit configuration JSON">
          {previewJson}
        </pre>
      </div>
    </ResultDrawer>
  )
}
