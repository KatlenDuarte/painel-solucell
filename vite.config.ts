import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Na Vercel o site fica na raiz do domínio; no GitHub Pages, em /painel-solucell/
export default defineConfig({
  plugins: [react()],
  base: process.env.VERCEL ? '/' : '/painel-solucell/',
})
