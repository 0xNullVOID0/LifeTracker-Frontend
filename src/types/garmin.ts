export type DailyStress = {
  date: string
  average: number
  max: number
  createdAt: string
  updatedAt: string
}

export type DailyHeartRate = {
  date: string
  restingRate: number
  min: number
  max: number
  samples: HeartRateSample[]
  createdAt: string
  updatedAt: string
}

export type HeartRateSample = {
  date: string
  timestamp: string
  bpm: number
  sleeping: boolean
  createdAt: string
  updatedAt: string
}

export type DailySleep = {
  date: string
  startGMT: string
  endGMT: string
  startLocal: string
  endLocal: string
  sleepTimeSeconds: number
  deepSleepSeconds: number
  lightSleepSeconds: number
  remSleepSeconds: number
  awakeSleepSeconds: number
  avgHeartRate: number
  avgSleepStress: number
  createdAt: string
  updatedAt: string
}
