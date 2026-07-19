import { useContext } from 'react'
import { CircuitContext } from './CircuitContextCore'

export function useCircuitContext() {
  const context = useContext(CircuitContext)
  if (context === null) {
    throw new Error('useCircuitContext must be used within CircuitProvider.')
  }

  return context
}
