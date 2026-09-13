import {apiFetch} from './client.ts'
import type {BuienradarMeasurement} from '../types/buienradar.ts'
import { azureFetch } from './azure.ts'

// export function getBuienradar(): Promise<BuienradarMeasurement[] | null> {
//   return apiFetch<BuienradarMeasurement[]>('/api/buienradar')
// }

export function getBuienradar(): Promise<BuienradarMeasurement[] | null> {
  return azureFetch<BuienradarMeasurement[]>('/api/buienradar')
}

export function syncBuienradar(): Promise<BuienradarMeasurement | null> {
  return apiFetch<BuienradarMeasurement>('/api/buienradar', { method: 'POST' })
}
