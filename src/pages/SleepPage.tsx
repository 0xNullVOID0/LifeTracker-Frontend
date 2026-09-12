import {useEffect, useState} from 'react'
import {getAwakeWindow, getDailySleep} from '../api/garmin.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import type {AwakeWindow, DailySleep} from '../types/garmin.ts'
import {DatePicker} from '../DatePicker.tsx'
import {useRequestedDate} from '../useRequestedDate.ts'
import {GarminNav} from './GarminNav.tsx'

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

function formatTimeSpan(value: string): string {
  const match = /^(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2})/.exec(value)
  if (!match) return value
  const days = Number(match[1] ?? 0)
  const hours = Number(match[2])
  const minutes = Number(match[3])
  if (days > 0) return `${days}d ${hours}h ${String(minutes).padStart(2, '0')}m`
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

function loadErrorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError) return caught.message
  return fallback
}

export function SleepPage() {
  const { logout } = useAuth()
  const { date, requestedDate, onSubmit, requestDate } = useRequestedDate()
  const [data, setData] = useState<DailySleep | null>(null)
  const [awake, setAwake] = useState<AwakeWindow | null>(null)
  const [empty, setEmpty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [awakeError, setAwakeError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setPending(true)
      setError(null)
      setAwakeError(null)
      setEmpty(false)

      try {
        const [sleepOutcome, awakeOutcome] = await Promise.allSettled([
          getDailySleep(requestedDate),
          getAwakeWindow(requestedDate),
        ])
        if (cancelled) return

        if (sleepOutcome.status === 'fulfilled') {
          setData(sleepOutcome.value)
          setEmpty(sleepOutcome.value === null)
        } else {
          setData(null)
          setEmpty(false)
          setError(loadErrorMessage(sleepOutcome.reason, 'Could not load sleep'))
        }

        if (awakeOutcome.status === 'fulfilled') {
          setAwake(awakeOutcome.value)
        } else {
          setAwake(null)
          setAwakeError(loadErrorMessage(awakeOutcome.reason, 'Could not load awake window'))
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
          <DatePicker value={date} onChange={requestDate} disabled={pending} />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? 'Loading…' : 'Load'}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
      {awakeError ? <p className="error">{awakeError}</p> : null}

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
            <span>Awake in bed</span>
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

      {awake ? (
        <section className="card metrics">
          <p>
            <span>Awake window</span>
            <strong>
              {awake.priorSleepID} → {awake.subsequentSleepID}
            </strong>
          </p>
          <p>
            <span>From</span>
            <strong>{formatTimestamp(awake.startLocal)}</strong>
          </p>
          <p>
            <span>Until</span>
            <strong>{formatTimestamp(awake.endLocal)}</strong>
          </p>
          <p>
            {/* TODO Duration or Awake for */}
            <span>Awake for</span>
            <strong>{formatTimeSpan(awake.duration)}</strong>
          </p>
        </section>
      ) : null}

      {data && !awake && !awakeError ? (
        <p className="empty">No awake window for {requestedDate} (204). Needs the previous night's sleep row.</p>
      ) : null}
    </main>
  )
}
