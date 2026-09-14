import {useEffect, useMemo, useState} from 'react'
import {getBuienradar} from '../api/buienradar.ts'
import {getRoomClimate} from '../api/climate.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import {IndoorOutdoorCharts} from '../charts.tsx'
import {DatePicker} from '../DatePicker.tsx'
import {parseClimateTimestamp, toIsoDateInZone} from '../dates.ts'
import type {BuienradarMeasurement} from '../types/buienradar.ts'
import type {RoomClimateMeasurement} from '../types/climate.ts'
import {useRequestedDate} from '../useRequestedDate.ts'
import {GarminNav} from './GarminNav.tsx'

export function InsideOutsidePage() {
  const { logout } = useAuth()
  const { date, requestedDate, onSubmit, requestDate } = useRequestedDate()
  const [indoor, setIndoor] = useState<RoomClimateMeasurement[]>([])
  const [outdoor, setOutdoor] = useState<BuienradarMeasurement[]>([])
  const [indoorError, setIndoorError] = useState<string | null>(null)
  const [outdoorError, setOutdoorError] = useState<string | null>(null)
  const [pending, setPending] = useState(true)

  useEffect(() => {
    let cancelled = false

    loadIndoor(requestedDate)
      .then((rows) => {
        if (cancelled) return
        setIndoorError(null)
        setIndoor(rows)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setIndoor([])
        setIndoorError(caught instanceof ApiError ? caught.message : 'Could not load local room climate')
      })
      .finally(() => {
        if (!cancelled) setPending(false)
      })

    return () => {
      cancelled = true
    }
  }, [requestedDate])

  useEffect(() => {
    let cancelled = false
    getBuienradar()
      .then((rows) => {
        if (!cancelled) setOutdoor(rows ?? [])
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setOutdoor([])
        setOutdoorError(caught instanceof ApiError ? caught.message : 'Could not load Buienradar')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const outdoorDay = useMemo(
    () => outdoor.filter((row) => toIsoDateInZone(new Date(row.timestamp)) === requestedDate),
    [outdoor, requestedDate],
  )

  const latestIndoor = indoor.length > 0 ? newestIndoor(indoor) : null
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
          <DatePicker value={date} onChange={requestDate} disabled={pending} />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? 'Loading…' : 'Load'}
        </button>
      </form>

      {indoorError ? <p className="error">Indoor: {indoorError}</p> : null}
      {outdoorError ? <p className="error">Outdoor: {outdoorError}</p> : null}

      {!pending && indoor.length === 0 && outdoorDay.length === 0 ? (
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

      <IndoorOutdoorCharts indoor={indoor} outdoor={outdoorDay} />
    </main>
  )
}

async function loadIndoor(date: string): Promise<RoomClimateMeasurement[]> {
  try {
    const all = await getRoomClimate()
    if (all && all.length > 0) {
      return all.filter((row) => toIsoDateInZone(parseClimateTimestamp(row.timestamp)) === date)
    }
  } catch (caught) {
    if (!(caught instanceof ApiError) || (caught.status !== 404 && caught.status !== 405)) throw caught
  }
  return []
}

function newestIndoor(rows: RoomClimateMeasurement[]): RoomClimateMeasurement {
  return rows.reduce((best, row) => (row.timestamp > best.timestamp ? row : best))
}

function newestOutdoor(rows: BuienradarMeasurement[]): BuienradarMeasurement {
  return rows.reduce((best, row) => (row.timestamp > best.timestamp ? row : best))
}
