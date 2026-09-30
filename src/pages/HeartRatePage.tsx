import {useState} from 'react'
import {getDailyHeartRate, getDailySleep} from '../api/garmin.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import type {DailyHeartRate, DailySleep} from '../types/garmin.ts'
import {HeartRateChart, type SleepWindow} from '../charts.tsx'
import {addDays} from '../dates.ts'
import {DatePicker} from '../DatePicker.tsx'
import {TodayButton, UpdateNowButton} from '../RefreshButtons.tsx'
import {liveSlowMs, useLiveRefresh} from '../useLiveRefresh.ts'
import {useRequestedDate} from '../useRequestedDate.ts'
import {GarminNav} from './GarminNav.tsx'

function formatTimestamp(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function sleepWindowFromSleep(sleep: DailySleep): SleepWindow | null {
  const start = new Date(sleep.startLocal).getTime()
  const end = new Date(sleep.endLocal).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null
  return { start, end }
}

export function HeartRatePage() {
  const { logout } = useAuth()
  const { date, requestedDate, onSubmit, requestDate } = useRequestedDate()
  const [data, setData] = useState<DailyHeartRate | null>(null)
  const [sleepWindows, setSleepWindows] = useState<SleepWindow[]>([])
  const [empty, setEmpty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { pending, updateNow } = useLiveRefresh(
    requestedDate,
    async ({ mode, isCurrent }) => {
      if (mode === 'initial') {
        setData(null)
        setSleepWindows([])
        setError(null)
        setEmpty(false)
      }

      const nextDate = addDays(requestedDate, 1)
      const [heartOutcome, sleepToday, sleepTomorrow] = await Promise.allSettled([
        getDailyHeartRate(requestedDate),
        mode === 'poll' ? Promise.resolve(null) : getDailySleep(requestedDate),
        mode === 'poll' ? Promise.resolve(null) : getDailySleep(nextDate),
      ])
      if (!isCurrent()) return

      if (heartOutcome.status === 'fulfilled') {
        setData(heartOutcome.value)
        setEmpty(heartOutcome.value === null)
        setError(null)
      } else if (mode === 'poll') {
        const caught = heartOutcome.reason
        setError(caught instanceof ApiError ? caught.message : 'Could not load heart rate')
      } else {
        setData(null)
        setEmpty(false)
        const caught = heartOutcome.reason
        setError(caught instanceof ApiError ? caught.message : 'Could not load heart rate')
      }

      if (mode === 'poll') return

      const windows: SleepWindow[] = []
      for (const outcome of [sleepToday, sleepTomorrow]) {
        if (outcome.status !== 'fulfilled' || !outcome.value) continue
        const window = sleepWindowFromSleep(outcome.value)
        if (window) windows.push(window)
      }
      setSleepWindows(windows)
    },
    liveSlowMs,
  )

  return (
    <main className="page wide">
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

      {empty && !error ? (
        <p className="empty">
          No heart rate row for {requestedDate} (204). Try another date, or sync / seed Garmin heart rate.
        </p>
      ) : null}

      {data ? (
        <>
          {data.samples.length > 0 ? (
            <HeartRateChart samples={data.samples} sleepWindows={sleepWindows} />
          ) : null}

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
