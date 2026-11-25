import {useState} from 'react'
import {fetchBuienradarSeries, syncBuienradar} from '../api/buienradar.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import {BuienradarCharts} from '../charts.tsx'
import {cacheKeys, hasCache, loadCache, readCache, refreshScopes} from '../dataCache.ts'
import {DateStepper} from '../DateStepper.tsx'
import {addDays} from '../dates.ts'
import type {BuienradarMeasurement} from '../types/buienradar.ts'
import {TodayButton, UpdateNowButton} from '../RefreshButtons.tsx'
import {buienradarDay} from '../seriesCache.ts'
import {liveMinuteMs, useLiveRefresh} from '../useLiveRefresh.ts'
import {useRequestedDate} from '../useRequestedDate.ts'
import {GarminNav} from './NavBar.tsx'

export function WeatherPage() {
  const { logout } = useAuth()
  const { date, requestedDate, onSubmit, requestDate } = useRequestedDate()
  const [rows, setRows] = useState<BuienradarMeasurement[] | null>(
    () => readCache<BuienradarMeasurement[]>(cacheKeys.buienradar)?.value ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const { pending, cooldownMs, updateNow } = useLiveRefresh(
    'buienradar',
    async ({ mode, isCurrent }) => {
      try {
        const result = await loadCache(cacheKeys.buienradar, fetchBuienradarSeries, {
          force: mode === 'manual',
          maxAge: mode === 'poll' ? 0 : liveMinuteMs,
        })
        if (!isCurrent()) return
        setRows(result)
        setError(null)
      } catch (caught) {
        if (!isCurrent()) return
        if (mode === 'initial' && !hasCache(cacheKeys.buienradar)) setRows(null)
        setError(caught instanceof ApiError ? caught.message : 'Could not load Weather')
      }
    },
    liveMinuteMs,
    { scope: refreshScopes.sensors, warm: hasCache(cacheKeys.buienradar) },
  )

  const dayRows = rows ? buienradarDay(rows, requestedDate) : emptyBuienradar

  const latest = dayRows.length > 0 ? newest(dayRows) : null

  async function onSync() {
    setSyncing(true)
    setError(null)
    try {
      await syncBuienradar()
      const result = await loadCache(cacheKeys.buienradar, fetchBuienradarSeries, { force: true })
      setRows(result)
      setError(null)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Weather sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <main className="page wide">
      <header className="topbar">
        <div>
          <h1>Weather</h1>
          <GarminNav />
        </div>
        <button type="button" className="ghost" onClick={logout}>
          Log out
        </button>
      </header>

      <p className="lede">Heino station measurements</p>

      <form className="toolbar" onSubmit={onSubmit}>
         {/* TODO: add day/week/month range charts + stepping like SleepPage/HeartRatePage */}
        <label>
          Date
          <DateStepper value={date} onChange={requestDate} step={(iso, direction) => addDays(iso, direction)} disabled={pending} />
        </label>
        <div className="toolbar-actions">
          <TodayButton date={requestedDate} onToday={requestDate} disabled={pending || syncing} />
          <button type="submit" disabled={pending || syncing}>
            {pending ? 'Loading…' : 'Load'}
          </button>
          <UpdateNowButton onClick={updateNow} pending={pending || syncing} cooldownMs={cooldownMs} />
          <button type="button" className="ghost" onClick={() => void onSync()} disabled={pending || syncing}>
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </form>

      {error ? <p className="error">{error}</p> : null}

      {!pending && dayRows.length === 0 ? (
        <p className="empty">No Weather rows for {requestedDate}.</p>
      ) : null}

      {latest ? (
        <>
          <section className="card metrics">
            <p>
              <span>Station</span>
              <strong>{latest.stationname}</strong>
            </p>
            <p>
              <span>Weather</span>
              <strong>{latest.weatherdescription ?? '—'}</strong>
            </p>
            <p>
              <span>Wind</span>
              <strong>
                {latest.winddirection ?? '—'}
                {latest.windspeed != null ? ` ${latest.windspeed.toFixed(1)} m/s` : ''}
              </strong>
            </p>
            <p>
              <span>Temperature</span>
              <strong>{latest.temperature.toFixed(1)}°C</strong>
            </p>
            <p>
              <span>Humidity</span>
              <strong>{latest.humidity.toFixed(1)}%</strong>
            </p>
            <p>
              <span>Rain (hour / 24h)</span>
              <strong>
                {fmt(latest.rainFallLastHour)} / {fmt(latest.rainFallLast24Hour)} mm
              </strong>
            </p>
            <p>
              <span>Sun power</span>
              <strong>{latest.sunpower ?? '—'}</strong>
            </p>
            <p>
              <span>Samples</span>
              <strong>{dayRows.length}</strong>
            </p>
          </section>
          <BuienradarCharts measurements={dayRows} />
        </>
      ) : null}
    </main>
  )
}

const emptyBuienradar: BuienradarMeasurement[] = []

function newest(rows: BuienradarMeasurement[]): BuienradarMeasurement {
  return rows.reduce((best, row) => (row.timestamp > best.timestamp ? row : best))
}

function fmt(value: number | null): string {
  if (value == null) return '—'
  return value.toFixed(1)
}
