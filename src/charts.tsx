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
  }
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
  const data = samples
    .map((sample) => ({
      t: new Date(sample.timestamp).getTime(),
      sleeping: sample.sleeping,
      bpm: sample.bpm,
    }))
    .filter((sample) => Number.isFinite(sample.t) && Number.isFinite(sample.bpm))
    .sort((a, b) => a.t - b.t)
  if (data.length === 0) return null
  const bpms = data.map((sample) => sample.bpm)
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
                const row = payload[0].payload as { sleeping?: boolean; bpm?: number }
                return (
                  <div className="chart-tooltip">
                    <div>{formatTickTime(Number(label))}</div>
                    <div>
                      {String(payload[0].value)} BPM{row.sleeping ? ' · sleep' : ''}
                    </div>
                  </div>
                )
              }}
            />
            <Line type="linear" dataKey="bpm" stroke={colors.line} dot={false} strokeWidth={1.5} isAnimationActive={false} />
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
