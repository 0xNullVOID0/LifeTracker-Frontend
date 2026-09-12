import {NavLink} from 'react-router-dom'

export function GarminNav() {
  return (
    <nav className="nav">
      <NavLink to="/day">Day</NavLink>
      <NavLink to="/stress">Stress</NavLink>
      <NavLink to="/heartrate">Heart rate</NavLink>
      <NavLink to="/sleep">Sleep</NavLink>
    </nav>
  )
}
