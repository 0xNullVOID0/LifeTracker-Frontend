import {useState} from 'react'
import {getDailyStress, getGarminDays} from '../api/garmin.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import type {DailyStress, GarminDay} from '../types/garmin.ts'
import {StressTrendChart} from '../charts.tsx'
import {cacheKeys, hasCache, loadCache, readCache, refreshScopes} from '../dataCache.ts'
import {DatePicker} from '../DatePicker.tsx'
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
  const empty = hasCache(cacheKeys.stress(requestedDate)) && data === null
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
        <label>
          Date
          <DatePicker value={date} onChange={requestDate} disabled={pending} />
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
