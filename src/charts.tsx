import {useEffect, useState} from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {formatTimeInZone, parseClimateTimestamp} from './dates.ts'
import type {BuienradarMeasurement} from './types/buienradar.ts'
import type {RoomClimateMeasurement} from './types/climate.ts'
import type {DailySleep, GarminDay, HeartRateSample} from './types/garmin.ts'

function useChartColors() {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return {
    text: dark ? '#b7b3be' : '#5c5666',
    line: dark ? '#d4c4ea' : '#3d2b56',
    grid: dark ? '#2e303a' : '#e5e4e7',
    deep: dark ? '#7c6b9a' : '#3d2b56',
    light: dark ? '#b7a4d4' : '#6b5288',
    rem: dark ? '#d4c4ea' : '#9b87b5',
    awake: dark ? '#f97066' : '#b42318',
    sleepBand: dark ? 'rgba(126, 184, 224, 0.18)' : 'rgba(42, 111, 151, 0.14)',
    avgLine: dark ? '#7eb8e0' : '#2a6f97',
  }
}

const averageWindowMs = 40 * 60 * 1000

function rollingAverage(points: { t: number; bpm: number }[]): number[] {
  return points.map((point) => {
    let sum = 0
    let count = 0
    for (const other of points) {
      if (Math.abs(other.t - point.t) <= averageWindowMs / 2) {
        sum += other.bpm
        count += 1
      }
    }
    return count > 0 ? sum / count : point.bpm
  })
}

export type SleepWindow = { start: number; end: number }

function sleepRangesFromSamples(samples: { t: number; sleeping: boolean }[]): SleepWindow[] {
  const ranges: SleepWindow[] = []
  let start: number | null = null
  for (const sample of samples) {
    if (sample.sleeping && start === null) start = sample.t
    if (!sample.sleeping && start !== null) {
      ranges.push({ start, end: sample.t })
      start = null
    }
  }
  if (start !== null && samples.length > 0) {
    ranges.push({ start, end: samples[samples.length - 1].t })
  }
  return ranges
}

function formatTickTime(value: number): string {
  return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function inferredGapLimit(points: { t: number }[]): number {
  if (points.length < 3) return 15 * 60 * 1000
  const gaps: number[] = []
  for (let i = 1; i < points.length; i++) {
    const gap = points[i].t - points[i - 1].t
    if (gap > 0) gaps.push(gap)
  }
  gaps.sort((a, b) => a - b)
  const median = gaps[Math.floor(gaps.length / 2)] ?? 5 * 60 * 1000
  return Math.max(median * 3, 10 * 60 * 1000)
}

function breakLineGaps<T extends { t: number }>(points: T[], empty: (t: number) => T): T[] {
  if (points.length === 0) return points
  const limit = inferredGapLimit(points)
  const out: T[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    if (points[i].t - points[i - 1].t > limit) {
      out.push(empty(points[i - 1].t + 1))
    }
    out.push(points[i])
  }
  return out
}

function formatTickDate(value: string): string {
  return value.slice(5)
}

export function HeartRateChart({
  samples,
  sleepWindows = [],
}: {
  samples: HeartRateSample[]
  sleepWindows?: SleepWindow[]
}) {
  const colors = useChartColors()
  const sorted = samples
    .map((sample) => ({
      t: new Date(sample.timestamp).getTime(),
      sleeping: sample.sleeping,
      bpm: sample.bpm,
    }))
    .filter((sample) => Number.isFinite(sample.t) && Number.isFinite(sample.bpm))
    .sort((a, b) => a.t - b.t)
  const averages = rollingAverage(sorted)
  const data = breakLineGaps(
    sorted.map((sample, index) => ({
      ...sample,
      bpm: sample.bpm as number | null,
      avg: (Math.round(averages[index] * 10) / 10) as number | null,
    })),
    (t) => ({ t, sleeping: false, bpm: null, avg: null }),
  )
  if (data.length === 0) return null
  const bpms = data.map((sample) => sample.bpm).filter((bpm): bpm is number => bpm != null)
  const yMin = Math.max(0, Math.min(...bpms) - 4)
  const yMax = Math.max(...bpms) + 4
  const tMin = data[0].t
  const tMax = data[data.length - 1].t
  const overlapping = sleepWindows.filter((band) => tMin != null && tMax != null && band.end > tMin && band.start < tMax)
  const bands = overlapping.length > 0 ? overlapping : sleepRangesFromSamples(data)

  return (
    <section className="card chart-card">
      <h2>BPM</h2>
      <p className="chart-legend">
        <span className="swatch sleep" /> Sleep
        <span className="swatch avg" /> Average
      </p>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {bands.map((band) => (
              <ReferenceArea
                key={`${band.start}-${band.end}`}
                x1={band.start}
                x2={band.end}
                fill={colors.sleepBand}
                ifOverflow="hidden"
              />
            ))}
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatTickTime}
              stroke={colors.text}
              tick={{ fill: colors.text, fontSize: 12 }}
            />
            <YAxis
              domain={[yMin, yMax]}
              allowDecimals={false}
              stroke={colors.text}
              tick={{ fill: colors.text, fontSize: 12 }}
              width={40}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.[0]) return null
                const row = payload[0].payload as { sleeping?: boolean; bpm?: number | null; avg?: number | null }
                if (row.bpm == null) return null
                return (
                  <div className="chart-tooltip">
                    <div>{formatTickTime(Number(label))}</div>
                    <div>
                      {row.bpm} BPM{row.sleeping ? ' · sleep' : ''}
                    </div>
                    <div>Avg {row.avg}</div>
                  </div>
                )
              }}
            />
            <Line type="linear" dataKey="bpm" stroke={colors.line} dot={false} strokeWidth={1.25} connectNulls={false} isAnimationActive={false} />
            <Line type="linear" dataKey="avg" stroke={colors.avgLine} dot={false} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export function SleepStagesChart({ sleep }: { sleep: DailySleep }) {
  const colors = useChartColors()
  const data = [
    {
      name: 'Stages',
      deep: sleep.deepSleepSeconds / 3600,
      light: sleep.lightSleepSeconds / 3600,
      rem: sleep.remSleepSeconds / 3600,
      awake: sleep.awakeSleepSeconds / 3600,
    },
  ]

  return (
    <section className="card chart-card">
      <h2>Sleep stages (hours)</h2>
      <div className="chart chart-short">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <XAxis type="number" unit="h" stroke={colors.text} tick={{ fill: colors.text, fontSize: 12 }} />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip
              formatter={(value, name) => [`${Number(value ?? 0).toFixed(1)}h`, String(name)]}
            />
            <Bar dataKey="deep" stackId="s" fill={colors.deep} name="Deep" />
            <Bar dataKey="light" stackId="s" fill={colors.light} name="Light" />
            <Bar dataKey="rem" stackId="s" fill={colors.rem} name="REM" />
            <Bar dataKey="awake" stackId="s" fill={colors.awake} name="Awake" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export function StressTrendChart({ days }: { days: GarminDay[] }) {
  const colors = useChartColors()
  const data = days
    .flatMap((day) =>
      day.stress ? [{ date: day.date, average: day.stress.average, max: day.stress.max }] : [],
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  if (data.length === 0) return null

  return (
    <section className="card chart-card">
      <h2>Stress trend</h2>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatTickDate} stroke={colors.text} tick={{ fill: colors.text, fontSize: 12 }} />
            <YAxis
              domain={[(min: number) => Math.max(0, Math.floor(min - 4)), (max: number) => Math.ceil(max + 4)]}
              allowDecimals={false}
              stroke={colors.text}
              tick={{ fill: colors.text, fontSize: 12 }}
              width={40}
            />
            <Tooltip />
            <Line type="monotone" dataKey="average" stroke={colors.line} dot={{ r: 3 }} strokeWidth={2} />
            <Line type="monotone" dataKey="max" stroke={colors.awake} dot={{ r: 3 }} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

type ClimatePoint = { t: number; temperature: number; humidity: number; co2: number }

export function RoomClimateCharts({ measurements }: { measurements: RoomClimateMeasurement[] }) {
  const colors = useChartColors()
  const data: ClimatePoint[] = measurements
    .map((row) => ({
      t: new Date(row.timestamp).getTime(),
      temperature: row.temperature,
      humidity: row.humidity,
      co2: row.cO2,
    }))
    .filter((row) => Number.isFinite(row.t))
    .sort((a, b) => a.t - b.t)

  if (data.length === 0) return null

  return (
    <>
      <ClimateSeries title="CO₂" data={data} dataKey="co2" unit=" ppm" stroke={colors.avgLine} colors={colors} />
      <ClimateSeries title="Temperature" data={data} dataKey="temperature" unit="°C" stroke={colors.line} colors={colors} />
      <ClimateSeries title="Humidity" data={data} dataKey="humidity" unit="%" stroke={colors.deep} colors={colors} />
    </>
  )
}

function ClimateSeries({
  title,
  data,
  dataKey,
  unit,
  stroke,
  colors,
}: {
  title: string
  data: ClimatePoint[]
  dataKey: keyof Omit<ClimatePoint, 't'>
  unit: string
  stroke: string
  colors: ReturnType<typeof useChartColors>
}) {
  const values = data.map((row) => row[dataKey])
  const yMin = Math.min(...values)
  const yMax = Math.max(...values)
  const pad = Math.max(0.5, (yMax - yMin) * 0.08)

  return (
    <section className="card chart-card">
      <h2>{title}</h2>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatTickTime}
              stroke={colors.text}
              tick={{ fill: colors.text, fontSize: 12 }}
            />
            <YAxis
              domain={[yMin - pad, yMax + pad]}
              stroke={colors.text}
              tick={{ fill: colors.text, fontSize: 12 }}
              width={48}
            />
            <Tooltip
              labelFormatter={(value) => formatTickTime(Number(value))}
              formatter={(value) => [`${Number(value ?? 0).toFixed(1)}${unit}`, title]}
            />
            <Line type="linear" dataKey={dataKey} stroke={stroke} dot={false} strokeWidth={1.5} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

type WeatherPoint = {
  t: number
  temperature: number | null
  humidity: number | null
  precipitation: number | null
  windspeed: number | null
  sunpower: number | null
  airpressure: number | null
}

export function BuienradarCharts({ measurements }: { measurements: BuienradarMeasurement[] }) {
  const colors = useChartColors()
  const data: WeatherPoint[] = breakLineGaps(
    measurements
      .map((row): WeatherPoint => ({
        t: new Date(row.timestamp).getTime(),
        temperature: row.temperature,
        humidity: row.humidity,
        precipitation: row.precipitation,
        windspeed: row.windspeed,
        sunpower: row.sunpower,
        airpressure: row.airpressure,
      }))
      .filter((row) => Number.isFinite(row.t))
      .sort((a, b) => a.t - b.t),
    (t) => ({
      t,
      temperature: null,
      humidity: null,
      precipitation: null,
      windspeed: null,
      sunpower: null,
      airpressure: null,
    }),
  )

  if (data.length === 0) return null

  return (
    <>
      <ClimateSeries
        title="Temperature"
        data={data}
        dataKey="temperature"
        unit="°C"
        stroke={colors.line}
        colors={colors}
        scale="decimal"
      />
      <ClimateSeries
        title="Humidity"
        data={data}
        dataKey="humidity"
        unit="%"
        stroke={colors.deep}
        colors={colors}
        scale="decimal"
      />
      <ClimateSeries
        title="Precipitation"
        data={data}
        dataKey="precipitation"
        unit=" mm"
        stroke={colors.avgLine}
        colors={colors}
        scale="decimal"
      />
      <ClimateSeries
        title="Wind"
        data={data}
        dataKey="windspeed"
        unit=" m/s"
        stroke={colors.avgLine}
        colors={colors}
        scale="decimal"
      />
      <ClimateSeries
        title="Sun power"
        data={data}
        dataKey="sunpower"
        unit=""
        stroke={colors.awake}
        colors={colors}
        scale="co2"
      />
    </>
  )
}
