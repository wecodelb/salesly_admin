import { useEffect, type ReactNode } from 'react'
import { useThemeStore } from './theme-store'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return <>{children}</>
}
