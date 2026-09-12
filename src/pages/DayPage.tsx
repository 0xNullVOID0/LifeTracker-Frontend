import {useEffect, useState} from 'react'
import {Link} from 'react-router-dom'
import {getAwakeWindow, getGarminDay, getGarminDays} from '../api/garmin.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import {DatePicker} from '../DatePicker.tsx'
import {dateQuery} from '../dates.ts'
import type {AwakeWindow, GarminDay} from '../types/garmin.ts'
import {useRequestedDate} from '../useRequestedDate.ts'
import {GarminNav} from './GarminNav.tsx'
import {StoredDays} from './StoredDays.tsx'

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

export function DayPage() {
  const { logout } = useAuth()
  const { date, requestedDate, onSubmit, requestDate } = useRequestedDate()
  const [data, setData] = useState<GarminDay | null>(null)
  const [days, setDays] = useState<GarminDay[]>([])
  const [awake, setAwake] = useState<AwakeWindow | null>(null)
  const [empty, setEmpty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [daysError, setDaysError] = useState<string | null>(null)
  const [awakeError, setAwakeError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setPending(true)
      setError(null)
      setDaysError(null)
      setAwakeError(null)
      setEmpty(false)

      try {
        const [dayOutcome, daysOutcome, awakeOutcome] = await Promise.allSettled([
          getGarminDay(requestedDate),
          getGarminDays(),
          getAwakeWindow(requestedDate),
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
          <DatePicker value={date} onChange={requestDate} disabled={pending} />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? 'Loading…' : 'Load'}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}
      {daysError ? <p className="error">{daysError}</p> : null}
      {awakeError ? <p className="error">{awakeError}</p> : null}

      {empty && !error ? (
        <p className="empty">No Garmin data for {requestedDate} (204). Try another date, or sync / seed.</p>
      ) : null}

      {data ? (
        <>
          <section className="card metrics">
            <h2>
              <Link to={`/heartrate${dateQuery(requestedDate)}`}>Heart rate</Link>
            </h2>
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
                  <strong>
                    <Link to={`/heartrate${dateQuery(requestedDate)}`}>
                      {data.heartRate.samples.length} — open
                    </Link>
                  </strong>
                </p>
              </>
            ) : (
              <p className="empty">No heart rate row</p>
            )}
          </section>

          <section className="card metrics">
            <h2>
              <Link to={`/stress${dateQuery(requestedDate)}`}>Stress</Link>
            </h2>
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
            <h2>
              <Link to={`/sleep${dateQuery(requestedDate)}`}>Sleep</Link>
            </h2>
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
                {awake ? (
                  <>
                    <p>
                      <span>Awake window</span>
                      <strong>
                        {awake.priorSleepID} → {awake.subsequentSleepID}
                      </strong>
                    </p>
                    <p>
                      <span>Awake from</span>
                      <strong>{formatTimestamp(awake.startLocal)}</strong>
                    </p>
                    <p>
                      <span>Awake until</span>
                      <strong>{formatTimestamp(awake.endLocal)}</strong>
                    </p>
                    <p>
                      <span>Awake for</span>
                      <strong>{formatTimeSpan(awake.duration)}</strong>
                    </p>
                  </>
                ) : !awakeError ? (
                  <p className="empty">No awake window (needs the previous night)</p>
                ) : null}
              </>
            ) : (
              <p className="empty">No sleep row</p>
            )}
          </section>
        </>
      ) : null}

      <StoredDays days={days} onSelectDate={requestDate} />
    </main>
  )
}
