import {azureFetch} from './azure.ts'
import type {RoomClimateMeasurement} from '../types/climate.ts'

export function getRoomClimate(): Promise<RoomClimateMeasurement[] | null> {
  return azureFetch<RoomClimateMeasurement[]>('/api/room-climate')
}
