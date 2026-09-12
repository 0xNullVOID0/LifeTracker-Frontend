import {useEffect, useState} from 'react'
import {getDailyStress} from '../api/garmin.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import type {DailyStress} from '../types/garmin.ts'
import {DatePicker} from '../DatePicker.tsx'
import {useRequestedDate} from '../useRequestedDate.ts'
import {GarminNav} from './GarminNav.tsx'

export function StressPage() {
  const { logout } = useAuth()
  const { date, requestedDate, onSubmit, requestDate } = useRequestedDate()
  const [data, setData] = useState<DailyStress | null>(null)
  const [empty, setEmpty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setPending(true)
      setError(null)
      setEmpty(false)
      try {
        const result = await getDailyStress(requestedDate)
        if (cancelled) return
        setData(result)
        setEmpty(result === null)
      } catch (caught) {
        if (cancelled) return
        setData(null)
        if (caught instanceof ApiError) {
          setError(caught.message)
        } else {
          setError('Could not load stress')
        }
      } finally {
        if (!cancelled) setPending(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [requestedDate])

  return (
    <main className="page">
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
        <button type="submit" disabled={pending}>
          {pending ? 'Loading…' : 'Load'}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}

      {empty && !error ? (
        <p className="empty">No stress row for {requestedDate} (204). Try another date, or run Demo compose so seed data exists.</p>
      ) : null}

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
