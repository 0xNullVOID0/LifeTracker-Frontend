import react from '@vitejs/plugin-react'
import {defineConfig} from 'vite'



const apiOrigin = 'http://127.0.0.1:5071'
const azureOrigin = 'https://lifetracker-adfrcsapexfubea8.swedencentral-01.azurewebsites.net'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: apiOrigin, changeOrigin: true },
      '/azure-api': {
        target: azureOrigin,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/azure-api/, ''),
      },
    },
  },
})
