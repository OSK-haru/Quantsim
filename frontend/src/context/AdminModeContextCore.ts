import { createContext } from 'react'

export type AdminModeValue = {
  /** 詳細モードが有効か。設定メニューのスイッチがそのままこの値。 */
  adminModeEnabled: boolean
  setAdminModeEnabled: (enabled: boolean) => void
  /** 内部情報（API・バックエンド・生データ・内部ID）を画面に出すか。 */
  internalInfoVisible: boolean
}

export const AdminModeContext = createContext<AdminModeValue | null>(null)
