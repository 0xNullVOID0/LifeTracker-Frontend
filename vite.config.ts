import react from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

const apiOrigin = 'http://127.0.0.1:5071'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: apiOrigin, changeOrigin: true },
    },
  },
})
