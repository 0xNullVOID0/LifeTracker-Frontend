import {Link} from 'react-router-dom'
import {addDays, dateQuery, fromIsoDate, isoWeek, startOfWeek} from '../dates.ts'
import type {GarminDay} from '../types/garmin.ts'

type StoredWeeksProps = {
  days: GarminDay[]
  selectedDate: string
  onSelectDate: (date: string) => void
  onSelectWeek: (weekStart: string) => void
}

type StoredWeek = {
  key: string
  label: string
  rangeLabel: string
  days: GarminDay[]
}

function groupWeeks(days: GarminDay[]): StoredWeek[] {
  const byWeek = new Map<string, GarminDay[]>()
  for (const day of days) {
    const key = startOfWeek(day.date)
    const list = byWeek.get(key)
    if (list) list.push(day)
    else byWeek.set(key, [day])
  }
  const weeks = Array.from(byWeek, ([key, list]): StoredWeek => ({
    key,
    label: `Week ${isoWeek(key)}`,
    rangeLabel: `${key.slice(5)}–${addDays(key, 6).slice(5)}`,
    days: list.sort((a, b) => (a.date < b.date ? 1 : -1)),
  }))
  return weeks.sort((a, b) => (a.key < b.key ? 1 : -1))
}

export function StoredWeeks({days, selectedDate, onSelectDate, onSelectWeek}: StoredWeeksProps) {
  if (days.length === 0) return null
  const weeks = groupWeeks(days)
  const selectedWeek = startOfWeek(selectedDate)

  return (
    <section className="card samples">
      <h2>Available weeks for Demo</h2>
      <div className="stored-weeks">
        {weeks.map((week) => (
          <div key={week.key} className={week.key === selectedWeek ? 'stored-week active' : 'stored-week'}>
            <button type="button" className="link" onClick={() => onSelectWeek(week.key)}>
              {week.label} · {week.rangeLabel} · {week.days.length} {week.days.length === 1 ? 'day' : 'days'}
            </button>
            <div className="stored-days">
              {week.days.map((day) => (
                <div
                  key={day.date}
                  className={day.date === selectedDate ? 'stored-day active' : 'stored-day'}
                >
                  <button type="button" className="stored-day-date" onClick={() => onSelectDate(day.date)}>
                    {fromIsoDate(day.date).toLocaleDateString(undefined, { weekday: 'short' })} {day.date.slice(5)}
                  </button>
                  {day.heartRate ? (
                    <Link className="stored-day-flag" title="Heart rate" to={`/heartrate${dateQuery(day.date)}`}>
                      HR
                    </Link>
                  ) : null}
                  {day.stress ? (
                    <Link className="stored-day-flag" title="Stress" to={`/stress${dateQuery(day.date)}`}>
                      ST
                    </Link>
                  ) : null}
                  {day.sleep ? (
                    <Link className="stored-day-flag" title="Sleep" to={`/sleep${dateQuery(day.date)}`}>
                      SL
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
