import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

type ProxyRequestLike = {
  removeHeader: (name: string) => void
}

type ProxyLike = {
  on: (event: 'proxyReq', handler: (proxyReq: ProxyRequestLike) => void) => unknown
}

export function applyApiProxyHeaders(proxy: ProxyLike) {
  proxy.on('proxyReq', (proxyReq: ProxyRequestLike) => {
    proxyReq.removeHeader('origin')
  })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://api.rotalog.madebyhermes.com',
        changeOrigin: true,
        configure: applyApiProxyHeaders,
      },
    },
  },
})
