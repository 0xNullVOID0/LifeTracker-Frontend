import {useState} from 'react'
import {getDailyHeartRate, getDailySleep, getGarminDays} from '../api/garmin.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import type {DailyHeartRate, DailySleep, GarminDay} from '../types/garmin.ts'
import {HeartRateChart, HeartRateTrendChart, type SleepWindow} from '../charts.tsx'
import {cacheKeys, cachedSlice, hasCache, loadCache, readCache, refreshScopes} from '../dataCache.ts'
import {DateStepper} from '../DateStepper.tsx'
import {addDays, fromIsoDate, isoWeek} from '../dates.ts'
import {publishGarminDays} from '../garminCache.ts'
import {monthDates, sleepByDate, weekDates} from '../sleepMath.ts'
import {TodayButton, UpdateNowButton} from '../RefreshButtons.tsx'
import {RangeToggle} from '../RangeToggle.tsx'
import {useDateState} from '../useDateState.ts'
import {liveSlowMs, useLiveRefresh} from '../useLiveRefresh.ts'
import {useRange} from '../useRange.ts'
import {useRequestedDate} from '../useRequestedDate.ts'
import {GarminNav} from './NavBar.tsx'

function formatTimestamp(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(undefined, { hour12: false })
}

function readSleepWindows(date: string): SleepWindow[] | undefined {
  const today = readCache<DailySleep | null>(cacheKeys.sleep(date))
  const tomorrow = readCache<DailySleep | null>(cacheKeys.sleep(addDays(date, 1)))
  if (!today && !tomorrow) return undefined
  const windows: SleepWindow[] = []
  for (const box of [today, tomorrow]) {
    if (!box?.value) continue
    const window = sleepWindowFromSleep(box.value)
    if (window) windows.push(window)
  }
  return windows
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
  const [range, setRange, stepDate] = useRange('day')
  const [data, setData] = useDateState(
    requestedDate,
    (day) => readCache<DailyHeartRate | null>(cacheKeys.heart(day))?.value,
    null,
  )
  const [sleepWindows, setSleepWindows] = useDateState(requestedDate, readSleepWindows, [] as SleepWindow[])
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState<GarminDay[]>(() => readCache<GarminDay[]>(cacheKeys.garminDays)?.value ?? [])
  const empty = hasCache(cacheKeys.heart(requestedDate)) && data === null
  const { pending, cooldownMs, updateNow } = useLiveRefresh(
    requestedDate,
    async ({ mode, isCurrent }) => {
      const nextDate = addDays(requestedDate, 1)
      const [heartOutcome, sleepToday, sleepTomorrow, daysOutcome] = await Promise.allSettled([
        loadCache(cacheKeys.heart(requestedDate), () => getDailyHeartRate(requestedDate), {
          force: mode === 'manual',
          maxAge: mode === 'poll' ? 0 : liveSlowMs,
        }),
        mode === 'poll'
          ? Promise.resolve(null)
          : loadCache(cacheKeys.sleep(requestedDate), () => getDailySleep(requestedDate), {
              force: mode === 'manual',
              maxAge: liveSlowMs,
            }),
        mode === 'poll'
          ? Promise.resolve(null)
          : loadCache(cacheKeys.sleep(nextDate), () => getDailySleep(nextDate), {
              force: mode === 'manual',
              maxAge: liveSlowMs,
            }),
        loadCache(cacheKeys.garminDays, async () => (await getGarminDays()) ?? [], {
          force: mode === 'manual',
          maxAge: liveSlowMs,
        }),
      ])
      if (!isCurrent()) return

      if (heartOutcome.status === 'fulfilled') {
        setData(heartOutcome.value)
        setError(null)
      } else if (mode === 'poll' || hasCache(cacheKeys.heart(requestedDate))) {
        const caught = heartOutcome.reason
        setError(caught instanceof ApiError ? caught.message : 'Could not load heart rate')
      } else {
        setData(null)
        const caught = heartOutcome.reason
        setError(caught instanceof ApiError ? caught.message : 'Could not load heart rate')
      }

      if (daysOutcome.status === 'fulfilled') {
        publishGarminDays(daysOutcome.value, mode !== 'initial')
        setDays(daysOutcome.value)
      } else if (!hasCache(cacheKeys.garminDays)) {
        setDays([])
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
    { scope: refreshScopes.garmin, warm: hasCache(cacheKeys.heart(requestedDate)) || hasCache(cacheKeys.garminDays) },
  )

  const heartDates = range === 'week' ? weekDates(requestedDate) : range === 'month' ? monthDates(requestedDate) : [requestedDate]
  const heartTitle =
    range === 'month'
      ? `Heart rate for ${fromIsoDate(requestedDate).toLocaleString(undefined, { month: 'long' })}`
      : range === 'week'
        ? `Heart rate for Week ${isoWeek(requestedDate)}`
        : 'Heart rate'
  const heartSamples = cachedSlice(days, `heart-samples:${range}:${requestedDate}`, () =>
    days.flatMap((day) => (heartDates.includes(day.date) ? day.heartRate?.samples ?? [] : [])),
  )
  const periodTrendDays = cachedSlice(days, `heart-trend:${range}:${requestedDate}`, () =>
    days.filter((day) => heartDates.includes(day.date) && day.heartRate),
  )
  const periodSleepWindows = cachedSlice(days, `heart-windows:${range}:${requestedDate}`, () => {
    const sleepMap = sleepByDate(days)
    const sleepDates = new Set<string>()
    for (const iso of heartDates) {
      sleepDates.add(iso)
      sleepDates.add(addDays(iso, 1))
    }
    return [...sleepDates].flatMap((iso): SleepWindow[] => {
      const sleep = sleepMap.get(iso)
      const window = sleep ? sleepWindowFromSleep(sleep) : null
      return window ? [window] : []
    })
  })

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
          <DateStepper value={date} onChange={requestDate} step={stepDate} disabled={pending} />
        </label>
        <div className="toolbar-actions">
          <TodayButton date={requestedDate} onToday={requestDate} disabled={pending} />
          <button type="submit" disabled={pending}>
            {pending ? 'Loading…' : 'Load'}
          </button>
          <UpdateNowButton onClick={updateNow} pending={pending} cooldownMs={cooldownMs} />
        </div>
        <RangeToggle value={range} onChange={setRange} />
      </form>

      {error ? <p className="error">{error}</p> : null}

      {range === 'day' ? (
        <>
          {empty && !error ? (
            <p className="empty">
              No heart rate row for {requestedDate} (204). Try another date, or sync / seed Garmin heart rate.
            </p>
          ) : null}

          {data ? (
            <>
              <HeartRateChart
                samples={data.samples}
                sleepWindows={periodSleepWindows.length > 0 ? periodSleepWindows : sleepWindows}
              />

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
        </>
      ) : range === 'week' ? (
        <HeartRateChart samples={heartSamples} sleepWindows={periodSleepWindows} multiDay title={heartTitle} />
      ) : (
        <HeartRateTrendChart days={periodTrendDays} title={heartTitle} />
      )}
    </main>
  )
}
