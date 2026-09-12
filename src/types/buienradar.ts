export type BuienradarMeasurement = {
  timestamp: string
  stationid: number
  stationname: string
  weatherdescription: string | null
  winddirection: string | null
  precipitation: number | null
  sunpower: number | null
  rainFallLastHour: number | null
  rainFallLast24Hour: number | null
  windspeed: number | null
  airpressure: number | null
  temperature: number
  humidity: number
  createdAt: string
  updatedAt: string
}
