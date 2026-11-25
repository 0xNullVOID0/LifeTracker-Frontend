import type {Range} from './range.ts'

export function RangeToggle({value, onChange}: {value: Range; onChange: (next: Range) => void}) {
  return (
    <div className="range-toggle">
      <button type="button" className={value === 'day' ? 'active' : ''} onClick={() => onChange('day')}>
        Day
      </button>
      <button type="button" className={value === 'week' ? 'active' : ''} onClick={() => onChange('week')}>
        Week
      </button>
      <button type="button" className={value === 'month' ? 'active' : ''} onClick={() => onChange('month')}>
        Month
      </button>
    </div>
  )
}
