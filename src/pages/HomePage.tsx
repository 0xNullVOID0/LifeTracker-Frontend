import {useEffect, useMemo, useState} from 'react'
import {useNavigate, useSearchParams} from 'react-router-dom'
import {getGarminDays} from '../api/garmin.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import {HeartRateChart, HeartRateTrendChart, SleepWeekChart, type SleepWindow} from '../charts.tsx'
import {cacheKeys, cachedSlice, hasCache, loadCache, readCache, refreshScopes} from '../dataCache.ts'
import {publishGarminDays} from '../garminCache.ts'
import {DateStepper} from '../DateStepper.tsx'
import {addDays, fromIsoDate, formatSeconds, isoWeek, startOfMonth, startOfWeek, todayLocal} from '../dates.ts'
import {RangeToggle} from '../RangeToggle.tsx'
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
  AWAKE_CAP_SECONDS,
  AWAKE_INACCURATE_SECONDS,
} from '../sleepMath.ts'
import type {DailySleep, GarminDay} from '../types/garmin.ts'
import {type Range} from '../range.ts'
import {useRange} from '../useRange.ts'
import {useRequestedDate} from '../useRequestedDate.ts'
import {GarminNav} from './NavBar.tsx'
import {StoredWeeks} from './StoredWeeks.tsx'

function sleepWindowFromSleep(sleep: DailySleep): SleepWindow | null {
  const start = new Date(sleep.startLocal).getTime()
  const end = new Date(sleep.endLocal).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null
  return { start, end }
}

export function HomePage() {
  const { logout } = useAuth()
  const { date, requestedDate, onSubmit, requestDate } = useRequestedDate()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [range, setRange, stepDate] = useRange('week')
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
  const awakeSeconds = !sleeping && wake
    ? Math.min(AWAKE_CAP_SECONDS, Math.floor((now.getTime() - wake.getTime()) / 1000))
    : null
  const awakeInaccurate = awakeSeconds != null && awakeSeconds > AWAKE_INACCURATE_SECONDS

  const heartDates = range === 'month' ? [] : dates
  const heartSamples = cachedSlice(days, `home-heart-samples:${range}:${requestedDate}`, () =>
    days.flatMap((day) => (heartDates.includes(day.date) ? day.heartRate?.samples ?? [] : [])),
  )
  const heartSleepWindows = cachedSlice(days, `home-heart-windows:${range}:${requestedDate}`, () => {
    const sleepDates = new Set<string>()
    for (const iso of heartDates) {
      sleepDates.add(iso)
      sleepDates.add(addDays(iso, 1))
    }
    return [...sleepDates].flatMap((iso): SleepWindow[] => {
      const sleep = days.find((day) => day.date === iso)?.sleep
      const window = sleep ? sleepWindowFromSleep(sleep) : null
      return window ? [window] : []
    })
  })
  const heartRateTrendDays = cachedSlice(days, `home-heart-trend:${range}:${requestedDate}`, () =>
    days.filter((day) => dates.includes(day.date) && day.heartRate),
  )

  const sleepTitle =
    range === 'month'
      ? `Sleep for ${fromIsoDate(requestedDate).toLocaleString(undefined, { month: 'long' })}`
      : `Sleep for Week ${isoWeek(requestedDate)}`

  const heartTitle =
    range === 'month'
      ? `Heart rate for ${fromIsoDate(requestedDate).toLocaleString(undefined, { month: 'long' })}`
      : range === 'week'
        ? `Heart rate for Week ${isoWeek(requestedDate)}`
        : 'Heart rate'

  // The live rows (awake / since / recommended times) only make sense for the current period.
  const isCurrentPeriod =
    range === 'day'
      ? requestedDate === todayLocal()
      : range === 'week'
        ? requestedDate >= startOfWeek(todayLocal())
        : requestedDate >= startOfMonth(todayLocal())

  function selectStored(next: Range, nextDate: string) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('range', next)
    nextParams.set('date', nextDate)
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
          <DateStepper value={date} onChange={requestDate} step={stepDate} />
        </label>
        <div className="toolbar-actions">
          <TodayButton date={requestedDate} onToday={requestDate} />
          <UpdateNowButton onClick={updateNow} pending={activityLoading} cooldownMs={cooldownMs} />
        </div>
        <RangeToggle value={range} onChange={setRange} />
      </form>

      {error ? <p className="error">{error}</p> : null}

      <StoredWeeks
        days={days}
        selectedDate={requestedDate}
        onSelectDate={(iso) => selectStored('day', iso)}
        onSelectWeek={(weekStart) => selectStored('week', weekStart)}
      />

      {isCurrentPeriod ? (
        <section className="card metrics">
          <p>
            <span>Awake</span>
            <strong className="live-awake">
              {sleeping ? 'Asleep' : awakeSeconds != null ? formatSeconds(awakeSeconds) : '—'}
              {!sleeping && awakeSeconds != null && awakeInaccurate ? (
                <svg className="awake-flag" width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M6 1L11.4 10.5H0.6L6 1z" fill="currentColor" />
                  <path d="M6 4.2v2.8" stroke="var(--card)" strokeWidth="1.1" strokeLinecap="round" />
                  <circle cx="6" cy="8.6" r="0.6" fill="var(--card)" />
                </svg>
              ) : null}
            </strong>
          </p>
          {awakeInaccurate && awakeSeconds != null ? (
            <p className="awake-notice">Awake for over {formatSeconds(AWAKE_INACCURATE_SECONDS)}, Sleep data may be inaccurate or not synced yet.</p>
          ) : null}
          {wake && !sleeping ? (
            <p>
              <span>Since</span>
              <strong>{wake.toLocaleString(undefined, { hour12: false })}</strong>
            </p>
          ) : null}
          {recommended && !sleeping ? (
            <>
              <p>
                <span>Recommended bed</span>
                <strong>
                  {recommended.bed.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}
                  {now.getTime() > recommended.bed.getTime() ? ' (overdue)' : ''}
                </strong>
              </p>
              <p>
                <span>Recommended wake</span>
                <strong>{recommended.nextWake.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}</strong>
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
      ) : null}

      {range !== 'month' ? (
        <HeartRateChart
          samples={heartSamples}
          sleepWindows={heartSleepWindows}
          multiDay={range === 'week'}
          title={heartTitle}
          onSelect={(iso) => navigate(`/heartrate?date=${iso}`)}
        />
      ) : null}

      {range === 'month' ? (
        <HeartRateTrendChart days={heartRateTrendDays} title={heartTitle} />
      ) : null}

      {range !== 'day' ? (
        <SleepWeekChart
          title={sleepTitle}
          nights={overviewNights}
          selected={requestedDate}
          onSelect={(iso) => navigate(`/sleep?date=${iso}`)}
        />
      ) : null}
    </main>
  )
}
