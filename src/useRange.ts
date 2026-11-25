import {useSearchParams} from 'react-router-dom'
import {parseRange, stepByRange, type Range} from './range.ts'

export function useRange(fallback: Range = 'day'): [Range, (next: Range) => void, (iso: string, direction: -1 | 1) => string] {
  const [searchParams, setSearchParams] = useSearchParams()
  const range = parseRange(searchParams.get('range'), fallback)

  function setRange(next: Range) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('range', next)
    setSearchParams(nextParams, {replace: true})
  }

  function stepDate(current: string, direction: -1 | 1): string {
    return stepByRange(current, range, direction)
  }

  return [range, setRange, stepDate]
}
