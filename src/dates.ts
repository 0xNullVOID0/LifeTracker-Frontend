export function todayLocal(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function parseDateParam(value: string | null): string | null {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return null
}

export function dateQuery(date: string): string {
  return `?date=${encodeURIComponent(date)}`
}

export function fromIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toIsoDate(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

export function addDays(iso: string, days: number): string {
  const next = fromIsoDate(iso)
  next.setDate(next.getDate() + days)
  return toIsoDate(next)
}

export const appTimeZone = 'Europe/Amsterdam'

export function formatTimeInZone(value: Date | number, timeZone = appTimeZone): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })
}

export function toIsoDateInZone(value: Date, timeZone = appTimeZone): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

export function parseClimateTimestamp(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(iso)
  if (!match) return new Date(iso)
  return wallTimeInZone(
    appTimeZone,
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  )
}

function wallTimeInZone(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second)
  const offset = zoneOffsetMs(timeZone, new Date(utcGuess))
  const instant = new Date(utcGuess - offset)
  const offsetAfter = zoneOffsetMs(timeZone, instant)
  if (offsetAfter !== offset) return new Date(utcGuess - offsetAfter)
  return instant
}

function zoneOffsetMs(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const hour = read('hour') === 24 ? 0 : read('hour')
  const asUtc = Date.UTC(read('year'), read('month') - 1, read('day'), hour, read('minute'), read('second'))
  return asUtc - date.getTime()
}
