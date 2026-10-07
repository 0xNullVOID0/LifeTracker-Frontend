import {useEffect, useMemo, useState} from 'react'
import {useSearchParams} from 'react-router-dom'
import {getGarminDays} from '../api/garmin.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import {SleepWeekChart} from '../charts.tsx'
import {cacheKeys, cachedSlice, hasCache, loadCache, readCache, refreshScopes} from '../dataCache.ts'
import {publishGarminDays} from '../garminCache.ts'
import {DatePicker} from '../DatePicker.tsx'
import {formatSeconds, todayLocal} from '../dates.ts'
import {TodayButton, UpdateNowButton} from '../RefreshButtons.tsx'
import {liveMinuteMs, liveSlowMs, useLiveRefresh} from '../useLiveRefresh.ts'
import {
  activeSleep,
  awakeSince,
  monthDates,
  recommendedTimes,
  sleepByDate,
  sleepStatsForDates,
  weekDates,
} from '../sleepMath.ts'
import type {GarminDay} from '../types/garmin.ts'
import {useRequestedDate} from '../useRequestedDate.ts'
import {GarminNav} from './GarminNav.tsx'

type Range = 'day' | 'week' | 'month'

function parseRange(value: string | null): Range {
  if (value === 'day' || value === 'week' || value === 'month') return value
  return 'week'
}

export function HomePage() {
  const { logout } = useAuth()
  const { date, requestedDate, onSubmit, requestDate } = useRequestedDate()
  const [searchParams, setSearchParams] = useSearchParams()
  const range = parseRange(searchParams.get('range'))
  const [days, setDays] = useState<GarminDay[]>(() => readCache<GarminDay[]>(cacheKeys.garminDays)?.value ?? [])
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const { pending: activityLoading, cooldownMs, updateNow } = useLiveRefresh(
    requestedDate,
    async ({ mode, isCurrent }) => {
      const [daysOutcome] = await Promise.allSettled([
        mode === 'poll'
          ? Promise.resolve(null)
          : loadCache(cacheKeys.garminDays, async () => (await getGarminDays()) ?? [], {
              force: mode === 'manual',
              maxAge: liveSlowMs,
            }),
      ])
      if (!isCurrent()) return

      if (mode === 'poll') return

      if (daysOutcome.status === 'fulfilled' && daysOutcome.value) {
        publishGarminDays(daysOutcome.value, mode !== 'initial')
        setDays(daysOutcome.value)
        setError(null)
      } else if (daysOutcome.status === 'rejected') {
        if (!hasCache(cacheKeys.garminDays)) setDays([])
        setError(daysOutcome.reason instanceof ApiError ? daysOutcome.reason.message : 'Could not load Garmin days')
      }
    },
    liveMinuteMs,
    { scope: refreshScopes.home, warm:  hasCache(cacheKeys.garminDays) },
  )

  const dates = useMemo(() => {
    if (range === 'day') return [requestedDate]
    if (range === 'month') return monthDates(requestedDate)
    return weekDates(requestedDate)
  }, [range, requestedDate])

  const stats = useMemo(() => sleepStatsForDates(days, dates), [days, dates])
  const overviewNights = cachedSlice(days, `home-nights:${range}:${requestedDate}`, () => {
    const map = sleepByDate(days)
    const list = range === 'month' ? monthDates(requestedDate) : weekDates(requestedDate)
    return list.map((iso) => ({ date: iso, sleep: map.get(iso) ?? null }))
  })

  const sleeping = activeSleep(days, now)
  const wake = awakeSince(days, now)
  const recommended = wake ? recommendedTimes(wake) : null
  const today = todayLocal()

  function setRange(next: Range) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('range', next)
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <main className="page wide">
      <header className="topbar">
        <div>
          <h1>Home</h1>
          <GarminNav />
        </div>
        <button type="button" className="ghost" onClick={logout}>
          Log out
        </button>
      </header>

      <form className="toolbar" onSubmit={onSubmit}>
        <label>
          Date
          <DatePicker value={date} onChange={requestDate} />
        </label>
        <div className="toolbar-actions">
          <TodayButton date={requestedDate} onToday={requestDate} />
          <UpdateNowButton onClick={updateNow} pending={activityLoading} cooldownMs={cooldownMs} />
        </div>
        <div className="range-toggle">
          <button type="button" className={range === 'day' ? 'active' : ''} onClick={() => setRange('day')}>
            Day
          </button>
          <button type="button" className={range === 'week' ? 'active' : ''} onClick={() => setRange('week')}>
            Week
          </button>
          <button type="button" className={range === 'month' ? 'active' : ''} onClick={() => setRange('month')}>
            Month
          </button>
        </div>
      </form>

      {error ? <p className="error">{error}</p> : null}

      <section className="card metrics">
        <p>
          <span>Awake</span>
          <strong className="live-awake">
            {sleeping ? 'Asleep' : wake ? formatSeconds(Math.floor((now.getTime() - wake.getTime()) / 1000)) : '—'}
          </strong>
        </p>
        {wake && !sleeping ? (
          <p>
            <span>Since</span>
            <strong>{wake.toLocaleString()}</strong>
          </p>
        ) : null}
        {recommended && !sleeping ? (
          <>
            <p>
              <span>Recommended bed</span>
              <strong>
                {recommended.bed.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                {now.getTime() > recommended.bed.getTime() ? ' (overdue)' : ''}
              </strong>
            </p>
            <p>
              <span>Recommended wake</span>
              <strong>{recommended.nextWake.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</strong>
            </p>
          </>
        ) : null}
        <p>
          <span>Sleep this {range}</span>
          <strong>{formatSeconds(stats.totalSeconds)}</strong>
        </p>
        <p>
          <span>Target ({stats.nights} × 8h)</span>
          <strong>{formatSeconds(stats.targetSeconds)}</strong>
        </p>
        <p>
          <span>Shortfall</span>
          <strong>{formatSeconds(stats.shortfallSeconds)}</strong>
        </p>
        <p className="empty">
          Extra sleep on long nights do not cancel sleep debt.
        </p>
      </section>

      {range !== 'day' ? (
        <SleepWeekChart
          title={range === 'month' ? 'Sleep month' : 'Sleep week'}
          nights={overviewNights}
          selected={requestedDate}
          onSelect={requestDate}
        />
      ) : null}
    </main>
  )
}
