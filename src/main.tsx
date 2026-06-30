import 'react/jsx-runtime'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './core/theme/tokens.css'
import { App } from '@/app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
