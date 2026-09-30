import {todayLocal} from './dates.ts'

export function TodayButton({
  date,
  onToday,
  disabled,
}: {
  date: string
  onToday: (next: string) => void
  disabled?: boolean
}) {
  const today = todayLocal()
  return (
    <button type="button" className="ghost" onClick={() => onToday(today)} disabled={disabled || date === today}>
      Today
    </button>
  )
}

export function UpdateNowButton({ onClick, pending }: { onClick: () => void; pending: boolean }) {
  return (
    <button type="button" className="ghost" onClick={onClick} disabled={pending}>
      {pending ? 'Updating…' : 'Update now'}
    </button>
  )
}
