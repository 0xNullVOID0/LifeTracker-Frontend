import type {AwakeWindow, DailyHeartRate, DailySleep, DailyStress, GarminDay} from '../types/garmin.ts'
import {apiFetch} from './client.ts'

export function getDailyStress(date?: string): Promise<DailyStress | null> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return apiFetch<DailyStress>(`/api/garmin/stress${query}`)
}

export function getDailyHeartRate(date?: string): Promise<DailyHeartRate | null> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return apiFetch<DailyHeartRate>(`/api/garmin/heartrate${query}`)
}

export function getDailySleep(date?: string): Promise<DailySleep | null> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return apiFetch<DailySleep>(`/api/garmin/sleep${query}`)
}

export function getAwakeWindow(date?: string): Promise<AwakeWindow | null> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return apiFetch<AwakeWindow>(`/api/garmin/sleep/awake-window${query}`)
}

export function getGarminDay(date?: string): Promise<GarminDay | null> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return apiFetch<GarminDay>(`/api/garmin/day${query}`)
}

export function getGarminDays(): Promise<GarminDay[] | null> {
  return apiFetch<GarminDay[]>('/api/garmin/all')
}
