import {useEffect, useMemo, useState} from 'react'
import {getBuienradar, syncBuienradar} from '../api/buienradar.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import {BuienradarCharts} from '../charts.tsx'
import {DatePicker} from '../DatePicker.tsx'
import {toIsoDateInZone} from '../dates.ts'
import type {BuienradarMeasurement} from '../types/buienradar.ts'
import {useRequestedDate} from '../useRequestedDate.ts'
import {GarminNav} from './GarminNav.tsx'

export function BuienradarPage() {
  const { logout } = useAuth()
  const { date, requestedDate, onSubmit, requestDate } = useRequestedDate()
  const [rows, setRows] = useState<BuienradarMeasurement[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(true)

  async function load() {
    setPending(true)
    setError(null)
    try {
      const result = await getBuienradar()
      setRows(result ?? [])
    } catch (caught) {
      setRows(null)
      if (caught instanceof ApiError) {
        setError(caught.message)
      } else {
        setError('Could not load Buienradar')
      }
    } finally {
      setPending(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    getBuienradar()
      .then((result) => {
        if (!cancelled) setRows(result ?? [])
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setRows(null)
        if (caught instanceof ApiError) {
          setError(caught.message)
        } else {
          setError('Could not load Buienradar')
        }
      })
      .finally(() => {
        if (!cancelled) setPending(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const dayRows = useMemo(() => {
    if (!rows) return []
    return rows.filter((row) => toIsoDateInZone(new Date(row.timestamp)) === requestedDate)
  }, [rows, requestedDate])

  const latest = dayRows.length > 0 ? newest(dayRows) : null

  async function onSync() {
    setPending(true)
    setError(null)
    try {
      await syncBuienradar()
      await load()
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message)
      } else {
        setError('Buienradar sync failed')
      }
      setPending(false)
    }
  }

  return (
    <main className="page wide">
      <header className="topbar">
        <div>
          <h1>Buienradar</h1>
          <GarminNav />
        </div>
        <button type="button" className="ghost" onClick={logout}>
          Log out
        </button>
      </header>

      <p className="lede">Heino station measurements</p>

      <form className="toolbar" onSubmit={onSubmit}>
        <label>
          Date
          <DatePicker value={date} onChange={requestDate} disabled={pending} />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? 'Loading…' : 'Load'}
        </button>
        <button type="button" className="ghost" onClick={() => void onSync()} disabled={pending}>
          Sync now
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}

      {!pending && dayRows.length === 0 ? (
        <p className="empty">No Buienradar rows for {requestedDate}.</p>
      ) : null}

      {latest ? (
        <>
          <section className="card metrics">
            <p>
              <span>Station</span>
              <strong>{latest.stationname}</strong>
            </p>
            <p>
              <span>Weather</span>
              <strong>{latest.weatherdescription ?? '—'}</strong>
            </p>
            <p>
              <span>Wind</span>
              <strong>
                {latest.winddirection ?? '—'}
                {latest.windspeed != null ? ` ${latest.windspeed.toFixed(1)} m/s` : ''}
              </strong>
            </p>
            <p>
              <span>Temperature</span>
              <strong>{latest.temperature.toFixed(1)}°C</strong>
            </p>
            <p>
              <span>Humidity</span>
              <strong>{latest.humidity.toFixed(1)}%</strong>
            </p>
            <p>
              <span>Rain (hour / 24h)</span>
              <strong>
                {fmt(latest.rainFallLastHour)} / {fmt(latest.rainFallLast24Hour)} mm
              </strong>
            </p>
            <p>
              <span>Sun power</span>
              <strong>{latest.sunpower ?? '—'}</strong>
            </p>
            <p>
              <span>Samples</span>
              <strong>{dayRows.length}</strong>
            </p>
          </section>
          <BuienradarCharts measurements={dayRows} />
        </>
      ) : null}
    </main>
  )
}

function newest(rows: BuienradarMeasurement[]): BuienradarMeasurement {
  return rows.reduce((best, row) => (row.timestamp > best.timestamp ? row : best))
}

function fmt(value: number | null): string {
  if (value == null) return '—'
  return value.toFixed(1)
}
