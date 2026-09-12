import {NavLink, useSearchParams} from 'react-router-dom'
import {dateQuery, parseDateParam} from '../dates.ts'

export function GarminNav() {
  const [params] = useSearchParams()
  const date = parseDateParam(params.get('date'))
  const q = date ? dateQuery(date) : ''

  return (
    <nav className="nav">
      <NavLink to={`/day${q}`}>Day</NavLink>
      <NavLink to={`/heartrate${q}`}>Heart rate</NavLink>
      <NavLink to={`/stress${q}`}>Stress</NavLink>
      <NavLink to={`/sleep${q}`}>Sleep</NavLink>
      <NavLink to={`/climate${q}`}>Climate</NavLink>
      <NavLink to={`/buienradar${q}`}>Buienradar</NavLink>
    </nav>
  )
}
