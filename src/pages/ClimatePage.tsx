import {type FormEvent, useState} from 'react'
import {fetchRoomClimateDay} from '../api/climate.ts'
import {azureLogin, getAzureToken} from '../api/azure.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import {RoomClimateCharts} from '../charts.tsx'
import {cacheKeys, dropCache, hasCache, loadCache, readCache, refreshScopes} from '../dataCache.ts'
import {DatePicker} from '../DatePicker.tsx'
import {todayLocal} from '../dates.ts'
import type {RoomClimateMeasurement} from '../types/climate.ts'
import {TodayButton, UpdateNowButton} from '../RefreshButtons.tsx'
import {liveMinuteMs, useLiveRefresh} from '../useLiveRefresh.ts'
import {useRequestedDate} from '../useRequestedDate.ts'
import {GarminNav} from './GarminNav.tsx'

export function ClimatePage() {
  const { logout } = useAuth()
  const { date, requestedDate, onSubmit, requestDate } = useRequestedDate()
  const [azureToken, setAzureToken] = useState(getAzureToken)
  const [azurePassword, setAzurePassword] = useState('')
  const [rows, setRows] = useState<RoomClimateMeasurement[] | null>(() => {
    const cached = readCache<RoomClimateMeasurement[]>(cacheKeys.roomClimate(requestedDate))
    return cached?.value ?? null
  })
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const warm = Boolean(azureToken) && hasCache(cacheKeys.roomClimate(requestedDate))

  const { pending, cooldownMs, updateNow } = useLiveRefresh(
    `${azureToken ?? ''}:${requestedDate}`,
    async ({ mode, isCurrent }) => {
      if (!azureToken) return
      try {
        const result = await loadCache(cacheKeys.roomClimate(requestedDate), () => fetchRoomClimateDay(requestedDate), {
          force: mode === 'manual',
          maxAge: mode === 'poll' ? 0 : liveMinuteMs,
        })
        if (!isCurrent()) return
        setRows(result)
        setError(null)
      } catch (caught) {
        if (!isCurrent()) return
        if (caught instanceof ApiError && caught.status === 401) {
          dropCache(cacheKeys.roomClimate(requestedDate))
          setRows(null)
          setAzureToken(null)
          setError('Azure session expired. Sign in again.')
          return
        }
        if (mode === 'initial' && !hasCache(cacheKeys.roomClimate(requestedDate))) setRows(null)
        setError(caught instanceof ApiError ? caught.message : 'Could not load room climate from Azure')
      }
    },
    azureToken ? liveMinuteMs : null,
    { scope: refreshScopes.sensors, warm },
  )

  const dayRows = rows ?? emptyClimate

  async function onAzureLogin(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSigningIn(true)
    try {
      await azureLogin(azurePassword)
      setAzureToken(getAzureToken())
      setAzurePassword('')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        setError('Wrong Azure password')
      } else {
        setError('Azure login failed')
      }
    } finally {
      setSigningIn(false)
    }
  }

  return (
    <main className="page wide">
      <header className="topbar">
        <div>
          <h1>Room climate</h1>
          <GarminNav />
        </div>
        <button type="button" className="ghost" onClick={logout}>
          Log out
        </button>
      </header>

      <p className="lede">ESP32 measurements from the live Azure API. Garmin stays on your local API.</p>

      {!azureToken ? (
        <form className="card" onSubmit={onAzureLogin}>
          <label>
            Azure password
            <input
              type="password"
              name="azure-password"
              autoComplete="current-password"
              value={azurePassword}
              onChange={(event) => setAzurePassword(event.target.value)}
              required
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={signingIn}>
            {signingIn ? 'Signing in…' : 'Sign in to Azure'}
          </button>
        </form>
      ) : (
        <>
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

          {!pending && dayRows.length === 0 ? (
            <p className="empty">No room climate rows for {requestedDate}.</p>
          ) : null}

          {dayRows.length > 0 ? (
            <>
              {requestedDate === todayLocal() && Math.round(newest(dayRows).cO2) >= 800 ? (
                <p className={Math.round(newest(dayRows).cO2) >= 1200 ? 'warning warning-strong' : 'warning'}>
                  CO₂ is {Math.round(newest(dayRows).cO2)} ppm. Open a window.
                </p>
              ) : null}
              <section className="card metrics">
                <p>
                  <span>Samples</span>
                  <strong>{dayRows.length}</strong>
                </p>
                <p>
                  <span>Latest CO₂</span>
                  <strong>{Math.round(newest(dayRows).cO2)}</strong>
                </p>
                <p>
                  <span>Latest temp</span>
                  <strong>{newest(dayRows).temperature.toFixed(1)}°C</strong>
                </p>
                <p>
                  <span>Latest humidity</span>
                  <strong>{newest(dayRows).humidity.toFixed(1)}%</strong>
                </p>
              </section>
              <RoomClimateCharts measurements={dayRows} />
            </>
          ) : null}
        </>
      )}
    </main>
  )
}

const emptyClimate: RoomClimateMeasurement[] = []

function newest(rows: RoomClimateMeasurement[]): RoomClimateMeasurement {
  return rows.reduce((best, row) => (row.timestamp > best.timestamp ? row : best))
}
