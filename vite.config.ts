import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [tailwindcss()],
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
    jsxDev: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-dev-runtime',
      'react/jsx-runtime',
      'react-router-dom',
      '@tanstack/react-query',
      'axios',
      'zustand',
      'lucide-react',
    ],
  },
  server: {
    port: 5173,
  },
})
