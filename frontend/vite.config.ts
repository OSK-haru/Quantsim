import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const apiProxyTargets = ['http://127.0.0.1:8001', 'http://127.0.0.1:8000']

async function isHealthy(target: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 400)

  try {
    const response = await fetch(new URL('/api/health', target), {
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

async function resolveApiProxyTarget() {
  for (const target of apiProxyTargets) {
    if (await isHealthy(target)) {
      return target
    }
  }

  return apiProxyTargets[1]
}

export default defineConfig(async () => ({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: await resolveApiProxyTarget(),
        changeOrigin: true,
      },
    },
  },
}))
