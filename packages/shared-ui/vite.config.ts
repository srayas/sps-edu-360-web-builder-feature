import { defineConfig } from 'vite'
import tailWindCss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailWindCss()],
})
