import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // The repository is published at https://boumiza-1.github.io/Takwira24/
  base: '/Takwira24/',
  plugins: [react()],
  server: { host: '0.0.0.0' }
})
