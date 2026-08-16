import { useContext } from 'react'
import { ThemeContext } from './ThemeContextCore'

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === null) {
    throw new Error('useTheme must be used within ThemeProvider.')
  }

  return context
}
