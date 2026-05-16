import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import yaml from '@modyfi/vite-plugin-yaml'
import path from 'path'

export default defineConfig({
  base: process.env.PATH_PREFIX ? `${process.env.PATH_PREFIX}/` : '/',
  plugins: [react(), tailwindcss(), yaml()],
  resolve: {
    alias: {
      '@': '/src',
      '@config': path.resolve(__dirname, 'config.yml'),
    },
  },
})
