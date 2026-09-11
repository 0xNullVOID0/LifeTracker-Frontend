import type {DailyStress} from '../types/garmin.ts'
import {apiFetch} from './client.ts'

export function getDailyStress(date?: string): Promise<DailyStress | null> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return apiFetch<DailyStress>(`/api/garmin/stress${query}`)
}
