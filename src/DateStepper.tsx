import {DatePicker} from './DatePicker.tsx'

type DateStepperProps = {
  value: string
  onChange: (next: string) => void
  step: (iso: string, direction: -1 | 1) => string
  disabled?: boolean
}

export function DateStepper({value, onChange, step, disabled}: DateStepperProps) {
  return (
    <div className="date-stepper">
      <button type="button" className="step-btn" onClick={() => onChange(step(value, -1))} disabled={disabled} aria-label="Previous">
        ‹
      </button>
      <DatePicker value={value} onChange={onChange} disabled={disabled} />
      <button type="button" className="step-btn" onClick={() => onChange(step(value, 1))} disabled={disabled} aria-label="Next">
        ›
      </button>
    </div>
  )
}
