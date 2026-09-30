import {useState} from 'react'
import {getDailyStress, getGarminDays} from '../api/garmin.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import type {DailyStress, GarminDay} from '../types/garmin.ts'
import {StressTrendChart} from '../charts.tsx'
import {DatePicker} from '../DatePicker.tsx'
import {TodayButton, UpdateNowButton} from '../RefreshButtons.tsx'
import {liveSlowMs, useLiveRefresh} from '../useLiveRefresh.ts'
import {useRequestedDate} from '../useRequestedDate.ts'
import {GarminNav} from './GarminNav.tsx'

export function StressPage() {
  const { logout } = useAuth()
  const { date, requestedDate, onSubmit, requestDate } = useRequestedDate()
  const [data, setData] = useState<DailyStress | null>(null)
  const [empty, setEmpty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState<GarminDay[]>([])
  const { pending, updateNow } = useLiveRefresh(
    requestedDate,
    async ({ mode, isCurrent }) => {
      if (mode === 'initial') {
        setData(null)
        setError(null)
        setEmpty(false)
      }

      const [stressOutcome, daysOutcome] = await Promise.allSettled([
        getDailyStress(requestedDate),
        getGarminDays(),
      ])
      if (!isCurrent()) return

      if (stressOutcome.status === 'fulfilled') {
        setData(stressOutcome.value)
        setEmpty(stressOutcome.value === null)
        setError(null)
      } else if (mode === 'poll') {
        setError(stressOutcome.reason instanceof ApiError ? stressOutcome.reason.message : 'Could not load stress')
      } else {
        setData(null)
        setEmpty(false)
        setError(stressOutcome.reason instanceof ApiError ? stressOutcome.reason.message : 'Could not load stress')
      }

      if (daysOutcome.status === 'fulfilled') {
        setDays(daysOutcome.value ?? [])
      } else if (mode !== 'poll') {
        setDays([])
      }
    },
    liveSlowMs,
  )

  return (
    <main className="page wide">
      <header className="topbar">
        <div>
          <h1>Daily stress</h1>
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
        <p className="empty">No stress row for {requestedDate} (204). Try another date, or run Demo compose so seed data exists.</p>
      ) : null}

      <StressTrendChart days={days} />

      {data ? (
        <section className="card metrics">
          <p>
            <span>Date</span>
            <strong>{data.date}</strong>
          </p>
          <p>
            <span>Average</span>
            <strong>{data.average}</strong>
          </p>
          <p>
            <span>Max</span>
            <strong>{data.max}</strong>
          </p>
        </section>
      ) : null}
    </main>
  )
}
