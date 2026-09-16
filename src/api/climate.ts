import {azureFetch} from './azure.ts'
import type {RoomClimateMeasurement} from '../types/climate.ts'
import {dateQuery} from '../dates.ts'
import {apiFetch} from './client.ts'

export function getRoomClimate(date: string): Promise<RoomClimateMeasurement[] | null> {
  return azureFetch<RoomClimateMeasurement[]>(`/api/room-climate/day${dateQuery(date)}`)
}

// // TODO make generic based on env value and error handling
// export function getRoomClimate(date: string): Promise<RoomClimateMeasurement[] | null> {
//   return apiFetch<RoomClimateMeasurement[]>(`/api/room-climate/day${dateQuery(date)}`)
// }
