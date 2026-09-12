import {useEffect, useState} from 'react'
import {Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'
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
  }
}

function formatTickTime(value: number): string {
  return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatTickDate(value: string): string {
  return value.slice(5)
}

export function HeartRateChart({ samples }: { samples: HeartRateSample[] }) {
  const colors = useChartColors()
  const data = samples.map((sample) => ({
    t: new Date(sample.timestamp).getTime(),
    bpm: sample.bpm,
  }))

  return (
    <section className="card chart-card">
      <h2>BPM</h2>
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
            <YAxis stroke={colors.text} tick={{ fill: colors.text, fontSize: 12 }} width={40} />
            <Tooltip
              labelFormatter={(value) => formatTickTime(Number(value))}
              formatter={(value) => [value ?? 0, 'BPM']}
            />
            <Line type="monotone" dataKey="bpm" stroke={colors.line} dot={false} strokeWidth={1.5} />
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
            <YAxis stroke={colors.text} tick={{ fill: colors.text, fontSize: 12 }} width={40} />
            <Tooltip />
            <Line type="monotone" dataKey="average" stroke={colors.line} dot={{ r: 3 }} strokeWidth={2} />
            <Line type="monotone" dataKey="max" stroke={colors.awake} dot={{ r: 3 }} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
