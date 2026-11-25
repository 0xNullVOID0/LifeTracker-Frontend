import type {DailySleep, GarminDay} from './types/garmin.ts'
import {addDays, formatMs, formatSeconds, fromIsoDate, startOfMonth, startOfWeek, todayLocal} from './dates.ts'

export const TARGET_SLEEP_SECONDS = 8 * 3600
export const TARGET_WAKE_MS = 16 * 60 * 60 * 1000

export const AWAKE_CAP_SECONDS = 32 * 3600
export const AWAKE_INACCURATE_SECONDS = 24 * 3600

export function parseTimeSpanMs(value: string): number | null {
  const match = /^(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2})/.exec(value)
  if (!match) return null
  const days = Number(match[1] ?? 0)
  return ((days * 24 + Number(match[2])) * 3600 + Number(match[3]) * 60 + Number(match[4])) * 1000
}

export function sleepByDate(days: GarminDay[]): Map<string, DailySleep> {
  const map = new Map<string, DailySleep>()
  for (const day of days) {
    if (day.sleep) map.set(day.date, day.sleep)
  }
  return map
}

export function latestSleep(days: GarminDay[]): DailySleep | null {
  const sleeps = days.flatMap((day) => (day.sleep ? [day.sleep] : []))
  if (sleeps.length === 0) return null
  sleeps.sort((a, b) => new Date(a.endLocal).getTime() - new Date(b.endLocal).getTime())
  return sleeps[sleeps.length - 1]
}

export function activeSleep(days: GarminDay[], now: Date): DailySleep | null {
  const nowMs = now.getTime()
  for (const day of days) {
    if (!day.sleep) continue
    const start = new Date(day.sleep.startLocal).getTime()
    const end = new Date(day.sleep.endLocal).getTime()
    if (nowMs >= start && nowMs < end) return day.sleep
  }
  return null
}

export function awakeSince(days: GarminDay[], now: Date): Date | null {
  if (activeSleep(days, now)) return null
  const last = latestSleep(days)
  if (!last) return null
  const end = new Date(last.endLocal)
  if (end.getTime() > now.getTime()) return null
  return end
}

export function recommendedTimes(wake: Date): { bed: Date; nextWake: Date } {
  const bed = new Date(wake.getTime() + TARGET_WAKE_MS)
  return { bed, nextWake: new Date(bed.getTime() + TARGET_SLEEP_SECONDS * 1000) }
}

export type SleepRangeStats = {
  nights: number
  sleptNights: number
  totalSeconds: number
  targetSeconds: number
  shortfallSeconds: number
}

export function sleepStatsForDates(days: GarminDay[], dates: string[], today = todayLocal()): SleepRangeStats {
  const map = sleepByDate(days)
  let nights = 0
  let sleptNights = 0
  let totalSeconds = 0
  let shortfallSeconds = 0

  for (const date of dates) {
    if (date > today) continue
    nights += 1
    const sleep = map.get(date)
    if (!sleep) {
      if (date < today) shortfallSeconds += TARGET_SLEEP_SECONDS
      continue
    }
    sleptNights += 1
    totalSeconds += sleep.sleepTimeSeconds
    shortfallSeconds += Math.max(0, TARGET_SLEEP_SECONDS - sleep.sleepTimeSeconds)
  }

  return {
    nights,
    sleptNights,
    totalSeconds,
    targetSeconds: nights * TARGET_SLEEP_SECONDS,
    shortfallSeconds,
  }
}

export function weekDates(iso: string): string[] {
  const start = startOfWeek(iso)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

export function monthDates(iso: string): string[] {
  const start = startOfMonth(iso)
  const first = new Date(fromIsoDate(start).getFullYear(), fromIsoDate(start).getMonth() + 1, 0).getDate()
  return Array.from({ length: first }, (_, index) => addDays(start, index))
}

export function describeAwake(wake: Date, now: Date): string {
  return formatMs(now.getTime() - wake.getTime())
}

export { formatSeconds }
