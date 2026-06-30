import { RouterProvider } from 'react-router-dom'
import { Providers } from './providers'
import { router } from './router'
import { SplashScreen } from '@/shared/components/SplashScreen/SplashScreen'
import { useSplashStore } from '@/shared/components/SplashScreen/splash-store'

function AppInner() {
  const { showSplash, done } = useSplashStore()

  return (
    <>
      {showSplash && <SplashScreen onDone={done} />}
      <RouterProvider router={router} />
    </>
  )
}

export function App() {
  return (
    <Providers>
      <AppInner />
    </Providers>
  )
}
