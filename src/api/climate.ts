import type {RoomClimateMeasurement} from '../types/climate.ts'
import {azureFetch} from './azure.ts'
import {ApiError} from './client.ts'
import {dateQuery} from '../dates.ts'

export function getRoomClimate(): Promise<RoomClimateMeasurement[] | null> {
  return azureFetch<RoomClimateMeasurement[]>('/api/room-climate')
}

export function getRoomClimateByDay(date: string): Promise<RoomClimateMeasurement[] | null> {
  return azureFetch<RoomClimateMeasurement[]>(`/api/room-climate/day${dateQuery(date)}`)
}

export async function fetchRoomClimate(): Promise<RoomClimateMeasurement[]> {
  try {
    return (await getRoomClimate()) ?? []
  } catch (caught) {
    if (caught instanceof ApiError && (caught.status === 404 || caught.status === 405)) return []
    throw caught
  }
}

export async function fetchRoomClimateDay(date: string): Promise<RoomClimateMeasurement[]> {
  try {
    return (await getRoomClimateByDay(date)) ?? []
  } catch (caught) {
    if (caught instanceof ApiError && (caught.status === 404 || caught.status === 405)) return []
    throw caught
  }
}
