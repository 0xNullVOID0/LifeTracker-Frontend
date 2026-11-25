import {useState} from 'react'
import {Link} from 'react-router-dom'
import {getAwakeWindow, getGarminDay, getGarminDays} from '../api/garmin.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import {cacheKeys, hasCache, loadCache, readCache, refreshScopes} from '../dataCache.ts'
import {DatePicker} from '../DatePicker.tsx'
import {dateQuery} from '../dates.ts'
import {publishGarminDay, publishGarminDays} from '../garminCache.ts'
import type {AwakeWindow, GarminDay} from '../types/garmin.ts'
import {TodayButton, UpdateNowButton} from '../RefreshButtons.tsx'
import {useDateState} from '../useDateState.ts'
import {liveSlowMs, useLiveRefresh} from '../useLiveRefresh.ts'
import {useRequestedDate} from '../useRequestedDate.ts'
import {GarminNav} from './NavBar.tsx'
import {StoredDays} from './StoredDays.tsx'

function formatTimestamp(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(undefined, { hour12: false })
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
  const [data, setData] = useDateState(
    requestedDate,
    (day) => readCache<GarminDay | null>(cacheKeys.garminDay(day))?.value,
    null,
  )
  const [days, setDays] = useState<GarminDay[]>(() => readCache<GarminDay[]>(cacheKeys.garminDays)?.value ?? [])
  const [awake, setAwake] = useDateState(
    requestedDate,
    (day) => readCache<AwakeWindow | null>(cacheKeys.awake(day))?.value,
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [daysError, setDaysError] = useState<string | null>(null)
  const [awakeError, setAwakeError] = useState<string | null>(null)
  const empty = hasCache(cacheKeys.garminDay(requestedDate)) && data === null
  const dayCached = hasCache(cacheKeys.garminDay(requestedDate))
  const { pending, cooldownMs, updateNow } = useLiveRefresh(
    requestedDate,
    async ({ mode, isCurrent }) => {
      const [dayOutcome, daysOutcome, awakeOutcome] = await Promise.allSettled([
        loadCache(cacheKeys.garminDay(requestedDate), () => getGarminDay(requestedDate), {
          force: mode === 'manual',
          maxAge: mode === 'poll' ? 0 : liveSlowMs,
        }),
        loadCache(cacheKeys.garminDays, async () => (await getGarminDays()) ?? [], {
          force: mode === 'manual',
          maxAge: mode === 'poll' ? 0 : liveSlowMs,
        }),
        mode === 'poll'
          ? Promise.resolve(null)
          : loadCache(cacheKeys.awake(requestedDate), () => getAwakeWindow(requestedDate), {
              force: mode === 'manual',
              maxAge: liveSlowMs,
            }),
      ])
      if (!isCurrent()) return

      const overwrite = mode !== 'initial'
      if (daysOutcome.status === 'fulfilled') {
        publishGarminDays(daysOutcome.value, overwrite)
        setDays(daysOutcome.value)
        setDaysError(null)
      } else if (mode === 'poll' || hasCache(cacheKeys.garminDays)) {
        setDaysError(loadErrorMessage(daysOutcome.reason, 'Could not load Garmin days'))
      } else {
        setDays([])
        setDaysError(loadErrorMessage(daysOutcome.reason, 'Could not load Garmin days'))
      }

      if (dayOutcome.status === 'fulfilled') {
        if (dayOutcome.value) publishGarminDay(dayOutcome.value, overwrite)
        setData(dayOutcome.value)
        setError(null)
      } else if (mode === 'poll' || hasCache(cacheKeys.garminDay(requestedDate))) {
        const cached = readCache<GarminDay | null>(cacheKeys.garminDay(requestedDate))
        if (cached) setData(cached.value)
        setError(loadErrorMessage(dayOutcome.reason, 'Could not load Garmin day'))
      } else {
        setData(null)
        setError(loadErrorMessage(dayOutcome.reason, 'Could not load Garmin day'))
      }

      if (mode === 'poll') return

      if (awakeOutcome.status === 'fulfilled') {
        setAwake(awakeOutcome.value)
        setAwakeError(null)
      } else if (hasCache(cacheKeys.awake(requestedDate))) {
        setAwakeError(loadErrorMessage(awakeOutcome.reason, 'Could not load awake window'))
      } else {
        setAwake(null)
        setAwakeError(loadErrorMessage(awakeOutcome.reason, 'Could not load awake window'))
      }
    },
    liveSlowMs,
    {
      scope: refreshScopes.garmin,
      warm: dayCached || hasCache(cacheKeys.garminDays) || hasCache(cacheKeys.awake(requestedDate)),
    },
  )

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
        <div className="toolbar-actions">
          <TodayButton date={requestedDate} onToday={requestDate} disabled={pending} />
          <button type="submit" disabled={pending}>
            {pending ? 'Loading…' : 'Load'}
          </button>
          <UpdateNowButton onClick={updateNow} pending={pending} cooldownMs={cooldownMs} />
        </div>
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
