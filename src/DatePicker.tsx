import {useEffect, useId, useRef, useState} from 'react'
import {DayPicker} from 'react-day-picker'
import 'react-day-picker/style.css'
import {fromIsoDate, toIsoDate, todayLocal} from './dates.ts'

type DatePickerProps = {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}

export function DatePicker({ value, onChange, disabled }: DatePickerProps) {
  const selected = fromIsoDate(value)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(selected)
  const rootRef = useRef<HTMLDivElement>(null)
  const popupId = useId()

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const label = selected.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="datepicker" ref={rootRef}>
      <button
        type="button"
        className="datepicker-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popupId}
        onClick={() => {
          if (!open) setMonth(fromIsoDate(value))
          setOpen((current) => !current)
        }}
      >
        {label}
      </button>
      {open ? (
        <div className="datepicker-popover" id={popupId} role="dialog" aria-label="Choose date">
          <DayPicker
            mode="single"
            required
            animate
            navLayout="around"
            selected={selected}
            month={month}
            onMonthChange={setMonth}
            onSelect={(next) => {
              if (!next) return
              onChange(toIsoDate(next))
              setOpen(false)
            }}
            captionLayout="dropdown"
            startMonth={new Date(2020, 0)}
            endMonth={new Date(new Date().getFullYear() + 1, 11)}
            today={fromIsoDate(todayLocal())}
            weekStartsOn={1}
          />
        </div>
      ) : null}
    </div>
  )
}
