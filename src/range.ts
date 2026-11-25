import {addDays, addMonths} from './dates.ts'

export type Range = 'day' | 'week' | 'month'

export function parseRange(value: string | null, fallback: Range = 'day'): Range {
  if (value === 'day' || value === 'week' || value === 'month') return value
  return fallback
}

export function stepByRange(iso: string, range: Range, direction: -1 | 1): string {
  if (range === 'month') return addMonths(iso, direction)
  return addDays(iso, direction * (range === 'week' ? 7 : 1))
}
