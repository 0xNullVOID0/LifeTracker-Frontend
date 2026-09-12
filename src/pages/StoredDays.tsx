import {Link} from 'react-router-dom'
import type {GarminDay} from '../types/garmin.ts'
import {dateQuery} from '../dates.ts'

type StoredDaysProps = {
  days: GarminDay[]
  onSelectDate: (date: string) => void
}

export function StoredDays({ days, onSelectDate }: StoredDaysProps) {
  if (days.length === 0) return null

  return (
    <section className="card samples">
      <h2>Stored days</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>HR</th>
            <th>Stress</th>
            <th>Sleep</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <td>
                <button type="button" className="link" onClick={() => onSelectDate(day.date)}>
                  {day.date}
                </button>
              </td>
              <td>
                {day.heartRate ? (
                  <Link to={`/heartrate${dateQuery(day.date)}`}>yes</Link>
                ) : (
                  '—'
                )}
              </td>
              <td>
                {day.stress ? (
                  <Link to={`/stress${dateQuery(day.date)}`}>yes</Link>
                ) : (
                  '—'
                )}
              </td>
              <td>
                {day.sleep ? (
                  <Link to={`/sleep${dateQuery(day.date)}`}>yes</Link>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
