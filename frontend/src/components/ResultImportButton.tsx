import { useRef, type ChangeEvent } from 'react'
import './ResultImportButton.css'

type ResultImportButtonProps = {
  onImport: (file: File) => void
  /* 読み込みの結果表示。失敗した理由もここに出る。 */
  status: string
}

/*
 * 結果ファイルを選ぶボタンだけを切り出したもの。
 *
 * 結果がある画面では比較バーの中に読み込みが並ぶが、結果がまだ無い画面
 * （実行前・受け取ったファイルを開きたいだけの状態）には比較バー自体が
 * 出ない。そこにも読み込み口が要るので、両方から使える形にしてある。
 */
export function ResultImportButton({ onImport, status }: ResultImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    /* 同じファイルを選び直しても change が飛ぶよう、値を先に空へ戻す。 */
    event.target.value = ''
    if (file) {
      onImport(file)
    }
  }

  return (
    <div className="result-import-button">
      <button type="button" onClick={() => fileInputRef.current?.click()}>
        結果を読み込む
      </button>
      <input
        ref={fileInputRef}
        className="result-import-button__file-input"
        type="file"
        accept=".json,application/json"
        aria-label="結果ファイルを読み込む"
        onChange={handleFileChange}
      />
      <span className="result-import-button__status" aria-live="polite">
        {status}
      </span>
    </div>
  )
}
