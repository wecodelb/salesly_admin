/** ISO weekdays, Monday first, as the plan form lays them out. */
export const WEEKDAYS: { value: number; short: string }[] = [
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
  { value: 7, short: 'Sun' },
]

/** A plan's rhythm in words: "Mon, Thu · every 2 weeks". */
export function describeRhythm(weekdays: number[], everyWeeks: number): string {
  const days = [...weekdays]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAYS.find((w) => w.value === d)?.short)
    .filter(Boolean)
    .join(', ')
  if (!days) return '—'
  if (everyWeeks <= 1) return `${days} · every week`
  return `${days} · every ${everyWeeks} weeks`
}

/** Ticks a weekday on or off, keeping the list in week order. */
export function toggleWeekday(weekdays: number[], day: number): number[] {
  return weekdays.includes(day)
    ? weekdays.filter((d) => d !== day)
    : [...weekdays, day].sort((a, b) => a - b)
}

/** Today as Y-m-d in the browser's own timezone, not UTC. */
export function todayYmd(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
