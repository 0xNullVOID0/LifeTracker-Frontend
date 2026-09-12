import {apiFetch} from './client.ts'
import type {BuienradarMeasurement} from '../types/buienradar.ts'

export function getBuienradar(): Promise<BuienradarMeasurement[] | null> {
  return apiFetch<BuienradarMeasurement[]>('/api/buienradar')
}

export function syncBuienradar(): Promise<BuienradarMeasurement | null> {
  return apiFetch<BuienradarMeasurement>('/api/buienradar', { method: 'POST' })
}
