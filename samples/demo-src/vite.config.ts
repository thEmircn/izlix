import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Paketlenen demo: okunabilir bilesen adlari ve source map icin minify kapali, gelistirme React'i
export default defineConfig({
  root: __dirname, base: './', plugins: [react()],
  define: { 'process.env.NODE_ENV': '"development"' },
  build: { outDir: '../demo', emptyOutDir: true, minify: false, sourcemap: true }
})
