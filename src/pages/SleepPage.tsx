import {type FormEvent, useEffect, useState} from 'react'
import {getDailySleep} from '../api/garmin.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import type {DailySleep} from '../types/garmin.ts'
import {GarminNav} from './GarminNav.tsx'

function todayLocal(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function formatSeconds(total: number): string {
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

export function SleepPage() {
  const { logout } = useAuth()
  const [date, setDate] = useState(todayLocal)
  const [requestedDate, setRequestedDate] = useState(todayLocal)
  const [data, setData] = useState<DailySleep | null>(null)
  const [empty, setEmpty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setPending(true)
      setError(null)
      setEmpty(false)
      try {
        const result = await getDailySleep(requestedDate)
        if (cancelled) return
        setData(result)
        setEmpty(result === null)
      } catch (caught) {
        if (cancelled) return
        setData(null)
        if (caught instanceof ApiError) {
          setError(caught.message)
        } else {
          setError('Could not load sleep')
        }
      } finally {
        if (!cancelled) setPending(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [requestedDate])

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setRequestedDate(date)
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>Daily sleep</h1>
          <GarminNav />
        </div>
        <button type="button" className="ghost" onClick={logout}>
          Log out
        </button>
      </header>

      <form className="toolbar" onSubmit={onSubmit}>
        <label>
          Date
          <input type="date" name="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? 'Loading…' : 'Load'}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}

      {empty && !error ? (
        <p className="empty">
          No sleep row for {requestedDate} (204). Try another date, or sync / seed Garmin sleep.
        </p>
      ) : null}

      {data ? (
        <section className="card metrics">
          <p>
            <span>Date</span>
            <strong>{data.date}</strong>
          </p>
          <p>
            <span>Start (local)</span>
            <strong>{formatTimestamp(data.startLocal)}</strong>
          </p>
          <p>
            <span>End (local)</span>
            <strong>{formatTimestamp(data.endLocal)}</strong>
          </p>
          <p>
            <span>Sleep time</span>
            <strong>{formatSeconds(data.sleepTimeSeconds)}</strong>
          </p>
          <p>
            <span>Deep</span>
            <strong>{formatSeconds(data.deepSleepSeconds)}</strong>
          </p>
          <p>
            <span>Light</span>
            <strong>{formatSeconds(data.lightSleepSeconds)}</strong>
          </p>
          <p>
            <span>REM</span>
            <strong>{formatSeconds(data.remSleepSeconds)}</strong>
          </p>
          <p>
            <span>Awake</span>
            <strong>{formatSeconds(data.awakeSleepSeconds)}</strong>
          </p>
          <p>
            <span>Avg heart rate</span>
            <strong>{data.avgHeartRate}</strong>
          </p>
          <p>
            <span>Avg sleep stress</span>
            <strong>{data.avgSleepStress}</strong>
          </p>
        </section>
      ) : null}
    </main>
  )
}
