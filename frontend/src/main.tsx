import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AnimationSettingsProvider } from './context/AnimationSettingsContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnimationSettingsProvider>
      <App />
    </AnimationSettingsProvider>
  </StrictMode>,
)
