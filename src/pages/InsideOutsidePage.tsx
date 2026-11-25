import {useState} from 'react'
import {fetchBuienradarSeries} from '../api/buienradar.ts'
import {fetchRoomClimateDay} from '../api/climate.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import {IndoorOutdoorCharts} from '../charts.tsx'
import {cacheKeys, hasCache, loadCache, readCache, refreshScopes} from '../dataCache.ts'
import {DateStepper} from '../DateStepper.tsx'
import {addDays} from '../dates.ts'
import type {BuienradarMeasurement} from '../types/buienradar.ts'
import type {RoomClimateMeasurement} from '../types/climate.ts'
import {TodayButton, UpdateNowButton} from '../RefreshButtons.tsx'
import {buienradarDay} from '../seriesCache.ts'
import {useDateState} from '../useDateState.ts'
import {liveMinuteMs, useLiveRefresh} from '../useLiveRefresh.ts'
import {useRequestedDate} from '../useRequestedDate.ts'
import {GarminNav} from './NavBar.tsx'

export function InsideOutsidePage() {
  const { logout } = useAuth()
  const { date, requestedDate, onSubmit, requestDate } = useRequestedDate()
  const [outdoor, setOutdoor] = useState<BuienradarMeasurement[]>(
    () => readCache<BuienradarMeasurement[]>(cacheKeys.buienradar)?.value ?? [],
  )
  const [indoor, setIndoor] = useDateState(
    requestedDate,
    (day) => readCache<RoomClimateMeasurement[]>(cacheKeys.roomClimate(day))?.value,
    [] as RoomClimateMeasurement[],
  )
  const [indoorError, setIndoorError] = useState<string | null>(null)
  const [outdoorError, setOutdoorError] = useState<string | null>(null)
  const { pending, cooldownMs, updateNow } = useLiveRefresh(
    requestedDate,
    async ({ mode, isCurrent }) => {
      const [indoorOutcome, outdoorOutcome] = await Promise.allSettled([
        loadCache(cacheKeys.roomClimate(requestedDate), () => fetchRoomClimateDay(requestedDate), {
          force: mode === 'manual',
          maxAge: mode === 'poll' ? 0 : liveMinuteMs,
        }),
        loadCache(cacheKeys.buienradar, fetchBuienradarSeries, {
          force: mode === 'manual',
          maxAge: mode === 'poll' ? 0 : liveMinuteMs,
        }),
      ])
      if (!isCurrent()) return

      if (indoorOutcome.status === 'fulfilled') {
        setIndoor(indoorOutcome.value)
        setIndoorError(null)
      } else if (mode === 'poll' || hasCache(cacheKeys.roomClimate(requestedDate))) {
        setIndoorError(indoorOutcome.reason instanceof ApiError ? indoorOutcome.reason.message : 'Could not load local room climate')
      } else {
        setIndoor([])
        setIndoorError(indoorOutcome.reason instanceof ApiError ? indoorOutcome.reason.message : 'Could not load local room climate')
      }

      if (outdoorOutcome.status === 'fulfilled') {
        setOutdoor(outdoorOutcome.value)
        setOutdoorError(null)
      } else if (mode === 'poll' || hasCache(cacheKeys.buienradar)) {
        setOutdoorError(outdoorOutcome.reason instanceof ApiError ? outdoorOutcome.reason.message : 'Could not load Buienradar')
      } else {
        setOutdoor([])
        setOutdoorError(outdoorOutcome.reason instanceof ApiError ? outdoorOutcome.reason.message : 'Could not load Buienradar')
      }
    },
    liveMinuteMs,
    {
      scope: refreshScopes.sensors,
      warm: hasCache(cacheKeys.roomClimate(requestedDate)) || hasCache(cacheKeys.buienradar),
    },
  )

  const indoorDay = indoor
  const outdoorDay = buienradarDay(outdoor, requestedDate)

  const latestIndoor = indoorDay.length > 0 ? newestIndoor(indoorDay) : null
  const latestOutdoor = outdoorDay.length > 0 ? newestOutdoor(outdoorDay) : null

  return (
    <main className="page wide">
      <header className="topbar">
        <div>
          <h1>Inside / outside</h1>
          <GarminNav />
        </div>
        <button type="button" className="ghost" onClick={logout}>
          Log out
        </button>
      </header>

      <p className="lede">Local ESP32 + SCD40 sensor room climate with Buienradar Heino temp/humidity correlation/comparison charts</p>

      <form className="toolbar" onSubmit={onSubmit}>
        <label>
          Date
          <DateStepper value={date} onChange={requestDate} step={(iso, direction) => addDays(iso, direction)} disabled={pending} />
        </label>
        <div className="toolbar-actions">
          <TodayButton date={requestedDate} onToday={requestDate} disabled={pending} />
          <button type="submit" disabled={pending}>
            {pending ? 'Loading…' : 'Load'}
          </button>
          <UpdateNowButton onClick={updateNow} pending={pending} cooldownMs={cooldownMs} />
        </div>
      </form>

      {indoorError ? <p className="error">Indoor: {indoorError}</p> : null}
      {outdoorError ? <p className="error">Outdoor: {outdoorError}</p> : null}

      {!pending && indoorDay.length === 0 && outdoorDay.length === 0 ? (
        <p className="empty">No indoor or outdoor rows for {requestedDate}.</p>
      ) : null}

      {latestIndoor || latestOutdoor ? (
        <section className="card metrics">
          <p>
            <span>Indoor temp</span>
            <strong>{latestIndoor ? `${latestIndoor.temperature.toFixed(1)}°C` : '—'}</strong>
          </p>
          <p>
            <span>Outdoor temp</span>
            <strong>{latestOutdoor ? `${latestOutdoor.temperature.toFixed(1)}°C` : '—'}</strong>
          </p>
          <p>
            <span>Indoor humidity</span>
            <strong>{latestIndoor ? `${latestIndoor.humidity.toFixed(1)}%` : '—'}</strong>
          </p>
          <p>
            <span>Outdoor humidity</span>
            <strong>{latestOutdoor ? `${latestOutdoor.humidity.toFixed(1)}%` : '—'}</strong>
          </p>
        </section>
      ) : null}

      <IndoorOutdoorCharts indoor={indoorDay} outdoor={outdoorDay} />
    </main>
  )
}

function newestIndoor(rows: RoomClimateMeasurement[]): RoomClimateMeasurement {
  return rows.reduce((best, row) => (row.timestamp > best.timestamp ? row : best))
}

function newestOutdoor(rows: BuienradarMeasurement[]): BuienradarMeasurement {
  return rows.reduce((best, row) => (row.timestamp > best.timestamp ? row : best))
}
