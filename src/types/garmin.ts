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
