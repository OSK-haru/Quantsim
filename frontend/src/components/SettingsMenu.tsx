import './SettingsMenu.css'
import { useAnimationSettings } from '../context/useAnimationSettings'
import { usePetSettings } from '../context/usePetSettings'

export function SettingsMenu() {
  const { animationsEnabled, setAnimationsEnabled } = useAnimationSettings()
  const { petVisible, setPetVisible } = usePetSettings()

  return (
    <div className="settings-menu">
      <div className="settings-menu__header">
        <span>設定</span>
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
    </div>
  )
}
