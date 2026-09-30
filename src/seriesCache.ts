import {cachedSlice} from './dataCache.ts'
import {parseClimateTimestamp, toIsoDateInZone} from './dates.ts'
import type {BuienradarMeasurement} from './types/buienradar.ts'
import type {RoomClimateMeasurement} from './types/climate.ts'

export function climateDay(rows: RoomClimateMeasurement[], date: string): RoomClimateMeasurement[] {
  return cachedSlice(rows, `climate-day:${date}`, () =>
    rows.filter((row) => toIsoDateInZone(parseClimateTimestamp(row.timestamp)) === date),
  )
}

export function buienradarDay(rows: BuienradarMeasurement[], date: string): BuienradarMeasurement[] {
  return cachedSlice(rows, `buienradar-day:${date}`, () =>
    rows.filter((row) => toIsoDateInZone(new Date(row.timestamp)) === date),
  )
}
