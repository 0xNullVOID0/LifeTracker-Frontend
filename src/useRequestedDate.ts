import {type FormEvent, useState} from 'react'
import {useSearchParams} from 'react-router-dom'
import {parseDateParam, todayLocal} from './dates.ts'

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
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('date', next)
    setSearchParams(nextParams, { replace: true })
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    writeDate(date)
  }

  function requestDate(next: string) {
    setDate(next)
    writeDate(next)
  }

  return { date, setDate, requestedDate, onSubmit, requestDate }
}
