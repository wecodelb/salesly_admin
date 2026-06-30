import { create } from 'zustand'

interface SplashStore {
  showSplash: boolean
  trigger: () => void
  done: () => void
}

export const useSplashStore = create<SplashStore>((set) => ({
  showSplash: true,   // true on first load
  trigger: () => set({ showSplash: true }),
  done: () => set({ showSplash: false }),
}))
