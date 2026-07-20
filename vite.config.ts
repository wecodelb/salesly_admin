import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  // The React plugin owns the JSX transform. It replaces a hand-rolled
  // `esbuild: { jsx: 'automatic' }` block that stopped type-checking under
  // Vite 8 and, being esbuild-only, never provided fast refresh.
  plugins: [react(), tailwindcss()],
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
