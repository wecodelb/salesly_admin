import { useEffect, useState } from 'react'
import { SaleslyWordmark } from '../SaleslyWordmark/SaleslyWordmark'

interface Props {
  onDone: () => void
  duration?: number
}

export function SplashScreen({ onDone, duration = 2200 }: Props) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const fadeDelay = duration - 400
    const fadeTimer = setTimeout(() => setVisible(false), fadeDelay)
    const doneTimer = setTimeout(onDone, duration)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [duration, onDone])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'linear-gradient(160deg, #1A6FC4 0%, #0A3D8F 55%, #061F55 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'opacity 0.4s ease',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'all' : 'none',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Logo area */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {/* Brand mark — 54px, the size the mobile splash uses. */}
        <div style={{ marginBottom: 4 }}>
          <SaleslyWordmark fontSize={54} />
        </div>

        {/* Tagline */}
        <p
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.70)',
            letterSpacing: '0.01em',
            textAlign: 'center',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Your field team, always selling.
        </p>
      </div>

      {/* Spinner */}
      <div style={{ marginTop: 52 }}>
        <Spinner />
      </div>

      {/* Version */}
      <p
        style={{
          position: 'absolute',
          bottom: 28,
          margin: 0,
          fontSize: 12,
          color: 'rgba(255,255,255,0.30)',
          letterSpacing: '0.05em',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        v0.1.0
      </p>
    </div>
  )
}

function Spinner() {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.20)',
        borderTopColor: 'rgba(255,255,255,0.80)',
        animation: 'salesly-spin 0.8s linear infinite',
      }}
    />
  )
}
