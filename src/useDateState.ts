import {type Dispatch, type SetStateAction, useState} from 'react'

export function useDateState<T>(
  date: string,
  read: (date: string) => T | undefined,
  fallback: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const cached = read(date)
    return cached === undefined ? fallback : cached
  })
  const [stored, setStored] = useState(date)
  if (stored !== date) {
    setStored(date)
    const cached = read(date)
    setValue(cached === undefined ? fallback : cached)
  }
  return [value, setValue]
}
