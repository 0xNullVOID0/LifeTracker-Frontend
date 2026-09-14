import {type FormEvent, useEffect, useMemo, useState} from 'react'
import {getRoomClimate} from '../api/climate.ts'
import {azureLogin, getAzureToken} from '../api/azure.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import {RoomClimateCharts} from '../charts.tsx'
import {DatePicker} from '../DatePicker.tsx'
import {parseClimateTimestamp, toIsoDateInZone} from '../dates.ts'
import type {RoomClimateMeasurement} from '../types/climate.ts'
import {useRequestedDate} from '../useRequestedDate.ts'
import {GarminNav} from './GarminNav.tsx'

export function ClimatePage() {
  const { logout } = useAuth()
  const { date, requestedDate, onSubmit, requestDate } = useRequestedDate()
  const [azureToken, setAzureToken] = useState(getAzureToken)
  const [azurePassword, setAzurePassword] = useState('')
  const [rows, setRows] = useState<RoomClimateMeasurement[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!azureToken) return
    let cancelled = false

    async function load() {
      setPending(true)
      setError(null)
      try {
        const result = await getRoomClimate()
        if (cancelled) return
        setRows(result ?? [])
      } catch (caught) {
        if (cancelled) return
        setRows(null)
        if (caught instanceof ApiError && caught.status === 401) {
          setAzureToken(null)
          setError('Azure session expired. Sign in again.')
        } else if (caught instanceof ApiError) {
          setError(caught.message)
        } else {
          setError('Could not load room climate from Azure')
        }
      } finally {
        if (!cancelled) setPending(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [azureToken])

  const dayRows = useMemo(() => {
    if (!rows) return []
    return rows.filter((row) => toIsoDateInZone(parseClimateTimestamp(row.timestamp)) === requestedDate)
  }, [rows, requestedDate])

  async function onAzureLogin(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)
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
      setPending(false)
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

      <p className="lede">Local ESP32 room climate measurements from SCD40</p>

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
          <button type="submit" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in to Azure'}
          </button>
        </form>
      ) : (
        <>
          <form className="toolbar" onSubmit={onSubmit}>
            <label>
              Date
              <DatePicker value={date} onChange={requestDate} disabled={pending} />
            </label>
            <button type="submit" disabled={pending}>
              {pending ? 'Loading…' : 'Load'}
            </button>
          </form>

          {error ? <p className="error">{error}</p> : null}

          {!pending && dayRows.length === 0 ? (
            <p className="empty">No room climate rows for {requestedDate}.</p>
          ) : null}

          {dayRows.length > 0 ? (
            <>
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

function newest(rows: RoomClimateMeasurement[]): RoomClimateMeasurement {
  return rows.reduce((best, row) => (row.timestamp > best.timestamp ? row : best))
}
