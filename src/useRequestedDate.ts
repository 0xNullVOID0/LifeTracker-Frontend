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

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSearchParams({ date }, { replace: true })
  }

  function requestDate(next: string) {
    setDate(next)
    setSearchParams({ date: next }, { replace: true })
  }

  return { date, setDate, requestedDate, onSubmit, requestDate }
}
