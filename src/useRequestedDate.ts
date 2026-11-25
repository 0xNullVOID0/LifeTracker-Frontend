import {type FormEvent, useState} from 'react'
import {useSearchParams} from 'react-router-dom'
import {clampDate, parseDateParam, todayLocal} from './dates.ts'

export function useRequestedDate() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedDate = parseDateParam(searchParams.get('date')) ?? todayLocal()
  const [date, setDate] = useState(requestedDate)
  const [syncedDate, setSyncedDate] = useState(requestedDate)

  if (requestedDate !== syncedDate) {
    setSyncedDate(requestedDate)
    setDate(requestedDate)
  }

  function writeDate(next: string) {
    const clamped = clampDate(next)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('date', clamped)
    setSearchParams(nextParams, { replace: true })
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    writeDate(date)
  }

  function requestDate(next: string) {
    const clamped = clampDate(next)
    setDate(clamped)
    writeDate(clamped)
  }

  return { date, setDate, requestedDate, onSubmit, requestDate }
}
