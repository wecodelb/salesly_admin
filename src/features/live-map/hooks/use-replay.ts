import { useCallback, useEffect, useRef, useState } from 'react'
import { replayStep } from '../live-map-logic'

/**
 * The replay's playhead: where it is (0–100), whether it is moving, and how
 * fast. At 100 the map shows the day as it stands, which is also where it
 * rests when nobody is replaying anything.
 */
export function useReplay() {
  const [pct, setPct] = useState(100)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  // The animation reads the playhead from here rather than from state, so a
  // frame never works from a value an earlier frame has already moved past.
  const pctRef = useRef(pct)
  pctRef.current = pct

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()

    const tick = (now: number) => {
      const next = Math.min(100, pctRef.current + replayStep(now - last, speed))
      last = now
      pctRef.current = next
      setPct(next)

      if (next >= 100) {
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed])

  /** Play from where it is, or from the start if it is already at the end. */
  const toggle = useCallback(() => {
    if (playing) {
      setPlaying(false)
      return
    }
    if (pctRef.current >= 100) {
      pctRef.current = 0
      setPct(0)
    }
    setPlaying(true)
  }, [playing])

  const seek = useCallback((value: number) => {
    pctRef.current = value
    setPct(value)
  }, [])

  /** Back to the day as it stands: a new salesman, or a new day. */
  const reset = useCallback(() => {
    setPlaying(false)
    pctRef.current = 100
    setPct(100)
  }, [])

  return { pct, playing, speed, setSpeed, toggle, seek, reset }
}
