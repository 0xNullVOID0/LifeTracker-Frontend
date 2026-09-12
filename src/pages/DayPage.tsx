import {type FormEvent, useEffect, useState} from 'react'
import {getGarminDay, getGarminDays} from '../api/garmin.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import type {GarminDay} from '../types/garmin.ts'
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

function loadErrorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError) return caught.message
  return fallback
}

export function DayPage() {
  const { logout } = useAuth()
  const [date, setDate] = useState(todayLocal)
  const [requestedDate, setRequestedDate] = useState(todayLocal)
  const [data, setData] = useState<GarminDay | null>(null)
  const [days, setDays] = useState<GarminDay[]>([])
  const [empty, setEmpty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [daysError, setDaysError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setPending(true)
      setError(null)
      setDaysError(null)
      setEmpty(false)

      try {
        const [dayOutcome, daysOutcome] = await Promise.allSettled([
          getGarminDay(requestedDate),
          getGarminDays(),
        ])
        if (cancelled) return

        if (dayOutcome.status === 'fulfilled') {
          setData(dayOutcome.value)
          setEmpty(dayOutcome.value === null)
        } else {
          setData(null)
          setEmpty(false)
          setError(loadErrorMessage(dayOutcome.reason, 'Could not load Garmin day'))
        }

        if (daysOutcome.status === 'fulfilled') {
          setDays(daysOutcome.value ?? [])
        } else {
          setDays([])
          setDaysError(loadErrorMessage(daysOutcome.reason, 'Could not load Garmin days'))
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

  function loadDate(next: string) {
    setDate(next)
    setRequestedDate(next)
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>Garmin day</h1>
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
      {daysError ? <p className="error">{daysError}</p> : null}

      {empty && !error ? (
        <p className="empty">No Garmin data for {requestedDate} (204). Try another date, or sync / seed.</p>
      ) : null}

      {data ? (
        <>
          <section className="card metrics">
            <h2>Stress</h2>
            {data.stress ? (
              <>
                <p>
                  <span>Average</span>
                  <strong>{data.stress.average}</strong>
                </p>
                <p>
                  <span>Max</span>
                  <strong>{data.stress.max}</strong>
                </p>
              </>
            ) : (
              <p className="empty">No stress row</p>
            )}
          </section>

          <section className="card metrics">
            <h2>Heart rate</h2>
            {data.heartRate ? (
              <>
                <p>
                  <span>Resting</span>
                  <strong>{data.heartRate.restingRate}</strong>
                </p>
                <p>
                  <span>Min</span>
                  <strong>{data.heartRate.min}</strong>
                </p>
                <p>
                  <span>Max</span>
                  <strong>{data.heartRate.max}</strong>
                </p>
                <p>
                  <span>Samples</span>
                  <strong>{data.heartRate.samples.length}</strong>
                </p>
              </>
            ) : (
              <p className="empty">No heart rate row</p>
            )}
          </section>

          <section className="card metrics">
            <h2>Sleep</h2>
            {data.sleep ? (
              <>
                <p>
                  <span>Start (local)</span>
                  <strong>{formatTimestamp(data.sleep.startLocal)}</strong>
                </p>
                <p>
                  <span>End (local)</span>
                  <strong>{formatTimestamp(data.sleep.endLocal)}</strong>
                </p>
                <p>
                  <span>Sleep time</span>
                  <strong>{formatSeconds(data.sleep.sleepTimeSeconds)}</strong>
                </p>
                <p>
                  <span>Deep</span>
                  <strong>{formatSeconds(data.sleep.deepSleepSeconds)}</strong>
                </p>
                <p>
                  <span>Light</span>
                  <strong>{formatSeconds(data.sleep.lightSleepSeconds)}</strong>
                </p>
                <p>
                  <span>REM</span>
                  <strong>{formatSeconds(data.sleep.remSleepSeconds)}</strong>
                </p>
              </>
            ) : (
              <p className="empty">No sleep row</p>
            )}
          </section>
        </>
      ) : null}

      {days.length > 0 ? (
        <section className="card samples">
          <h2>Stored days</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Stress</th>
                <th>HR</th>
                <th>Sleep</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date}>
                  <td>
                    <button type="button" className="link" onClick={() => loadDate(day.date)}>
                      {day.date}
                    </button>
                  </td>
                  <td>{day.stress ? 'yes' : '—'}</td>
                  <td>{day.heartRate ? 'yes' : '—'}</td>
                  <td>{day.sleep ? 'yes' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </main>
  )
}
