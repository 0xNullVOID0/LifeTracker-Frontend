import {cacheKeys, hasCache, writeCache} from './dataCache.ts'
import type {GarminDay} from './types/garmin.ts'

function publishValue<T>(key: string, value: T | null | undefined, overwrite: boolean) {
  if (value == null) return
  if (!overwrite && hasCache(key)) return
  writeCache(key, value)
}

export function publishGarminDay(day: GarminDay, overwrite = false) {
  if (!day.date) return
  publishValue(cacheKeys.garminDay(day.date), day, overwrite)
  publishValue(cacheKeys.heart(day.date), day.heartRate, overwrite)
  publishValue(cacheKeys.stress(day.date), day.stress, overwrite)
  publishValue(cacheKeys.sleep(day.date), day.sleep, overwrite)
}

export function publishGarminDays(days: GarminDay[], overwrite = false) {
  for (const day of days) publishGarminDay(day, overwrite)
}
