import {type FormEvent, useEffect, useState} from 'react'
import {getDailyHeartRate} from '../api/garmin.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import type {DailyHeartRate} from '../types/garmin.ts'
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

export function HeartRatePage() {
  const { logout } = useAuth()
  const [date, setDate] = useState(todayLocal)
  const [requestedDate, setRequestedDate] = useState(todayLocal)
  const [data, setData] = useState<DailyHeartRate | null>(null)
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
        const result = await getDailyHeartRate(requestedDate)
        if (cancelled) return
        setData(result)
        setEmpty(result === null)
      } catch (caught) {
        if (cancelled) return
        setData(null)
        if (caught instanceof ApiError) {
          setError(caught.message)
        } else {
          setError('Could not load heart rate')
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
          <h1>Daily heart rate</h1>
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
          No heart rate row for {requestedDate} (204). Try another date, or sync / seed Garmin heart rate.
        </p>
      ) : null}

      {data ? (
        <>
          <section className="card metrics">
            <p>
              <span>Date</span>
              <strong>{data.date}</strong>
            </p>
            <p>
              <span>Resting</span>
              <strong>{data.restingRate}</strong>
            </p>
            <p>
              <span>Min</span>
              <strong>{data.min}</strong>
            </p>
            <p>
              <span>Max</span>
              <strong>{data.max}</strong>
            </p>
            <p>
              <span>Samples</span>
              <strong>{data.samples.length}</strong>
            </p>
          </section>

          {data.samples.length > 0 ? (
            <section className="card samples">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>BPM</th>
                    <th>Sleeping</th>
                  </tr>
                </thead>
                <tbody>
                  {data.samples.map((sample) => (
                    <tr key={sample.timestamp}>
                      <td>{formatTimestamp(sample.timestamp)}</td>
                      <td>{sample.bpm}</td>
                      <td>{sample.sleeping ? 'yes' : 'no'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  )
}
