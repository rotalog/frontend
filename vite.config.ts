import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // ALTERACAO: proxy para desenvolvimento local com backend em /api/v1.
    proxy: {
      '/api': {
        target: 'https://api.rotalog.madebyhermes.com',
        changeOrigin: true,
      },
    },
  },
})
