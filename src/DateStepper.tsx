import {DatePicker} from './DatePicker.tsx'

type DateStepperProps = {
  value: string
  onChange: (next: string) => void
  step: (iso: string, direction: -1 | 1) => string
  disabled?: boolean
}

export function StepChevron({direction}: {direction: -1 | 1}) {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={direction === -1 ? 'M10.25 3.5 5.75 8l4.5 4.5' : 'M5.75 3.5 10.25 8l-4.5 4.5'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function DateStepper({value, onChange, step, disabled}: DateStepperProps) {
  return (
    <div className="date-stepper">
      <button
        type="button"
        className="step-btn"
        onClick={() => onChange(step(value, -1))}
        disabled={disabled}
        aria-label="Previous"
      >
        <StepChevron direction={-1} />
      </button>
      <DatePicker value={value} onChange={onChange} disabled={disabled} />
      <button
        type="button"
        className="step-btn"
        onClick={() => onChange(step(value, 1))}
        disabled={disabled}
        aria-label="Next"
      >
        <StepChevron direction={1} />
      </button>
    </div>
  )
}
