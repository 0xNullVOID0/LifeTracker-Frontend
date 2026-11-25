import {useMemo, useState} from 'react'
import {getDailyStress, getGarminDays} from '../api/garmin.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import type {DailyStress, GarminDay} from '../types/garmin.ts'
import {StressTrendChart} from '../charts.tsx'
import {cacheKeys, hasCache, loadCache, readCache, refreshScopes} from '../dataCache.ts'
import {DateStepper, StepChevron} from '../DateStepper.tsx'
import {addDays} from '../dates.ts'
import {publishGarminDays} from '../garminCache.ts'
import {TodayButton, UpdateNowButton} from '../RefreshButtons.tsx'
import {useDateState} from '../useDateState.ts'
import {liveSlowMs, useLiveRefresh} from '../useLiveRefresh.ts'
import {useRequestedDate} from '../useRequestedDate.ts'
import {GarminNav} from './NavBar.tsx'

export function StressPage() {
  const { logout } = useAuth()
  const { date, requestedDate, onSubmit, requestDate } = useRequestedDate()
  const [data, setData] = useDateState(
    requestedDate,
    (day) => readCache<DailyStress | null>(cacheKeys.stress(day))?.value,
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState<GarminDay[]>(() => readCache<GarminDay[]>(cacheKeys.garminDays)?.value ?? [])
  const [month, setMonth] = useState(() => date.slice(0, 7))
  const empty = hasCache(cacheKeys.stress(requestedDate)) && data === null

  function shiftMonth(delta: number) {
    setMonth((current) => {
      const [year, monthIndex] = current.split('-').map(Number)
      const next = new Date(year, monthIndex - 1 + delta, 1)
      return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
    })
  }

  const trendDays = useMemo(
    () => days.filter((day) => day.date.startsWith(month) && day.stress),
    [days, month],
  )
  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const { pending, cooldownMs, updateNow } = useLiveRefresh(
    requestedDate,
    async ({ mode, isCurrent }) => {
      const [stressOutcome, daysOutcome] = await Promise.allSettled([
        loadCache(cacheKeys.stress(requestedDate), () => getDailyStress(requestedDate), {
          force: mode === 'manual',
          maxAge: mode === 'poll' ? 0 : liveSlowMs,
        }),
        loadCache(cacheKeys.garminDays, async () => (await getGarminDays()) ?? [], {
          force: mode === 'manual',
          maxAge: mode === 'poll' ? 0 : liveSlowMs,
        }),
      ])
      if (!isCurrent()) return

      const overwrite = mode !== 'initial'
      if (daysOutcome.status === 'fulfilled') {
        publishGarminDays(daysOutcome.value, overwrite)
        setDays(daysOutcome.value)
      } else if (!hasCache(cacheKeys.garminDays)) {
        setDays([])
      }

      if (stressOutcome.status === 'fulfilled') {
        setData(stressOutcome.value)
        setError(null)
      } else if (mode === 'poll' || hasCache(cacheKeys.stress(requestedDate))) {
        const cached = readCache<DailyStress | null>(cacheKeys.stress(requestedDate))
        if (cached) setData(cached.value)
        setError(stressOutcome.reason instanceof ApiError ? stressOutcome.reason.message : 'Could not load stress')
      } else {
        setData(null)
        setError(stressOutcome.reason instanceof ApiError ? stressOutcome.reason.message : 'Could not load stress')
      }
    },
    liveSlowMs,
    {
      scope: refreshScopes.garmin,
      warm: hasCache(cacheKeys.stress(requestedDate)) || hasCache(cacheKeys.garminDays),
    },
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
        {/* TODO: add day/week/month range charts + stepping like SleepPage/HeartRatePage*/}
        <label>
          Date
          <DateStepper value={date} onChange={requestDate} step={(iso, direction) => addDays(iso, direction)} disabled={pending} />
        </label>
        <label>
          Trend month
          <div className="date-stepper">
            <button type="button" className="step-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <StepChevron direction={-1} />
            </button>
            <span className="month-label">{monthLabel}</span>
            <button type="button" className="step-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
              <StepChevron direction={1} />
            </button>
          </div>
        </label>
        <div className="toolbar-actions">
          <TodayButton date={requestedDate} onToday={requestDate} disabled={pending} />
          <button type="submit" disabled={pending}>
            {pending ? 'Loading…' : 'Load'}
          </button>
          <UpdateNowButton onClick={updateNow} pending={pending} cooldownMs={cooldownMs} />
        </div>
      </form>

      {error ? <p className="error">{error}</p> : null}

      {empty && !error ? (
        <p className="empty">No stress row for {requestedDate} (204). Try another date, or run Demo compose so seed data exists.</p>
      ) : null}

      {trendDays.length === 0 ? (
        <p className="empty">No stress data for {monthLabel}.</p>
      ) : (
        <StressTrendChart days={trendDays} />
      )}

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
