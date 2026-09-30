import {useMemo, useState} from 'react'
import {getAwakeWindow, getDailySleep, getGarminDays} from '../api/garmin.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import type {AwakeWindow, DailySleep, GarminDay} from '../types/garmin.ts'
import {SleepStagesChart} from '../charts.tsx'
import {DatePicker} from '../DatePicker.tsx'
import {formatSeconds} from '../dates.ts'
import {TodayButton, UpdateNowButton} from '../RefreshButtons.tsx'
import {useLiveRefresh} from '../useLiveRefresh.ts'
import {useRequestedDate} from '../useRequestedDate.ts'
import {GarminNav} from './GarminNav.tsx'

function formatTimestamp(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
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
  const [days, setDays] = useState<GarminDay[]>([])

  const { pending, updateNow } = useLiveRefresh(
    requestedDate,
    async ({ mode, isCurrent }) => {
      if (mode === 'initial') {
        setData(null)
        setAwake(null)
      }
      setError(null)
      setAwakeError(null)
      setEmpty(false)

      const [sleepOutcome, awakeOutcome, daysOutcome] = await Promise.allSettled([
        getDailySleep(requestedDate),
        getAwakeWindow(requestedDate),
        getGarminDays(),
      ])
      if (!isCurrent()) return

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
        setAwakeError(null)
      } else {
        setAwake(null)
        setAwakeError(loadErrorMessage(awakeOutcome.reason, 'Could not load awake window'))
      }

      if (daysOutcome.status === 'fulfilled') setDays(daysOutcome.value ?? [])
    },
    null,
  )

  const weekNights = useMemo(() => {
    const map = sleepByDate(days)
    return weekDates(requestedDate).map((date) => ({ date, sleep: map.get(date) ?? null }))
  }, [days, requestedDate])

  return (
    <main className="page wide">
      <header className="topbar">
        <div>
          <h1>Sleep</h1>
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
        <div className="toolbar-actions">
          <TodayButton date={requestedDate} onToday={requestDate} disabled={pending} />
          <button type="submit" disabled={pending}>
            {pending ? 'Loading…' : 'Load'}
          </button>
          <UpdateNowButton onClick={updateNow} pending={pending} />
        </div>
      </form>

      {error ? <p className="error">{error}</p> : null}
      {awakeError ? <p className="error">{awakeError}</p> : null}

      <SleepWeekChart nights={weekNights} selected={requestedDate} onSelect={requestDate} />

      {empty && !error ? (
        <p className="empty">
          No sleep row for {requestedDate} (204). Try another date, or sync / seed Garmin sleep.
        </p>
      ) : null}

      {data ? (
        <>
          <SleepStagesChart sleep={data} />
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
        </>
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
