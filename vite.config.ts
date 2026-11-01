import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages: https://islasmendes.github.io/regional/
export default defineConfig({
  base: '/regional/',
  plugins: [react()],
})
