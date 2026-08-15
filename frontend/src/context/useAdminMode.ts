import { useContext } from 'react'
import { AdminModeContext } from './AdminModeContextCore'

export function useAdminMode() {
  const context = useContext(AdminModeContext)
  if (context === null) {
    throw new Error('useAdminMode must be used within AdminModeProvider.')
  }

  return context
}

/*
 * 表示側は「見せてよいかどうか」だけ知れば足りるので、
 * 内部情報を出し分けるだけの箇所はこちらを使う。
 */
export function useInternalInfoVisible() {
  return useAdminMode().internalInfoVisible
}
