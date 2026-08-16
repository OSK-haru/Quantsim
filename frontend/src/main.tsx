import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AdminModeProvider } from './context/AdminModeContext.tsx'
import { AnimationSettingsProvider } from './context/AnimationSettingsContext.tsx'
import { PetSettingsProvider } from './context/PetSettingsContext.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AdminModeProvider>
        <AnimationSettingsProvider>
          <PetSettingsProvider>
            <App />
          </PetSettingsProvider>
        </AnimationSettingsProvider>
      </AdminModeProvider>
    </ThemeProvider>
  </StrictMode>,
)
