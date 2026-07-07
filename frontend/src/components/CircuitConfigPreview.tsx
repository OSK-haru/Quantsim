import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import './CircuitConfigPreview.css'
import { ResultDrawer } from './ResultDrawer'
import type { CircuitEditorState } from '../types/circuit'
import { circuitEditorStateToConfig } from '../utils/circuitConfig'
import { exportCircuitConfigBundleJson } from '../utils/circuitConfigTransfer'

type CircuitConfigPreviewProps = {
  circuit: CircuitEditorState
  onImportCircuitConfig: (file: File) => Promise<string>
}

const PREVIEW_NOTE =
  'Preview only. Run simulation now uses the edited circuit shown in the editor.'

export function CircuitConfigPreview({
  circuit,
  onImportCircuitConfig,
}: CircuitConfigPreviewProps) {
  const previewJson = JSON.stringify(circuitEditorStateToConfig(circuit), null, 2)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [transferStatus, setTransferStatus] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setCopyStatus('idle')
  }, [previewJson])

  async function handleCopyJson() {
    try {
      await navigator.clipboard.writeText(previewJson)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
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
      description="Converted circuit state shown as API-compatible JSON."
      defaultOpen={false}
    >
      <div className="circuit-config-preview">
        <p className="circuit-config-preview__note">{PREVIEW_NOTE}</p>

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
            {transferStatus || (copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : ' ')}
          </span>
        </div>

        <input
          ref={fileInputRef}
          className="circuit-config-preview__file-input"
          type="file"
          accept=".json,.qscope.json,application/json"
          aria-label="Import circuit configuration JSON"
          onChange={handleFileChange}
        />

        <pre className="circuit-config-preview__json" aria-label="Circuit configuration JSON">
          {previewJson}
        </pre>
      </div>
    </ResultDrawer>
  )
}
