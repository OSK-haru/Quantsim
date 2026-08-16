import './SettingsMenu.css'
import { useAdminMode } from '../context/useAdminMode'
import { useAnimationSettings } from '../context/useAnimationSettings'
import { usePetSettings } from '../context/usePetSettings'
import { useTheme } from '../context/useTheme'

export function SettingsMenu() {
  const { animationsEnabled, setAnimationsEnabled } = useAnimationSettings()
  const { petVisible, setPetVisible } = usePetSettings()
  const { adminModeEnabled, setAdminModeEnabled } = useAdminMode()
  const { theme, toggleTheme } = useTheme()
  const darkModeEnabled = theme === 'dark'

  return (
    <div className="settings-menu">
      <div className="settings-menu__header">
        <span>設定</span>
      </div>
      <div className="settings-menu__row">
        <div className="settings-menu__row-label">
          <span>ダークモード</span>
          <small>画面の明るさと配色を切り替え</small>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={darkModeEnabled}
          aria-label="ダークモードを切り替え"
          className={`settings-menu__switch${darkModeEnabled ? ' settings-menu__switch--on' : ''}`}
          onClick={toggleTheme}
        >
          <span className="settings-menu__switch-knob" aria-hidden="true" />
        </button>
      </div>
      <div className="settings-menu__row">
        <div className="settings-menu__row-label">
          <span>アニメーション</span>
          <small>演出・遷移エフェクトの表示</small>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={animationsEnabled}
          aria-label="アニメーションの有効/無効を切り替え"
          className={`settings-menu__switch${animationsEnabled ? ' settings-menu__switch--on' : ''}`}
          onClick={() => setAnimationsEnabled(!animationsEnabled)}
        >
          <span className="settings-menu__switch-knob" aria-hidden="true" />
        </button>
      </div>
      <div className="settings-menu__row">
        <div className="settings-menu__row-label">
          <span>ガイドペット</span>
          <small>右下のシミュレーション状況ガイド</small>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={petVisible}
          aria-label="ガイドペットの表示/非表示を切り替え"
          className={`settings-menu__switch${petVisible ? ' settings-menu__switch--on' : ''}`}
          onClick={() => setPetVisible(!petVisible)}
        >
          <span className="settings-menu__switch-knob" aria-hidden="true" />
        </button>
      </div>

      <div className="settings-menu__row settings-menu__row--admin">
        <div className="settings-menu__row-label">
          <span>管理者モード</span>
          <small>内部情報（API・実行基盤・生データ・内部識別子）を表示</small>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={adminModeEnabled}
          aria-label="管理者モードの有効/無効を切り替え"
          className={`settings-menu__switch${adminModeEnabled ? ' settings-menu__switch--on' : ''}`}
          onClick={() => setAdminModeEnabled(!adminModeEnabled)}
        >
          <span className="settings-menu__switch-knob" aria-hidden="true" />
        </button>
      </div>
      {adminModeEnabled ? (
        <p className="settings-menu__admin-note">
          内部情報を表示中です。一般公開時はオフに戻してください。
        </p>
      ) : null}
    </div>
  )
}
