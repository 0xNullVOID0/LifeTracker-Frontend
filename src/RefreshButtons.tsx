import {formatCooldown} from './dataCache.ts'
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

export function UpdateNowButton({
  onClick,
  pending,
  cooldownMs = 0,
}: {
  onClick: () => void
  pending: boolean
  cooldownMs?: number
}) {
  const waiting = !pending && cooldownMs > 0
  return (
    <button type="button" className="ghost" onClick={onClick} disabled={pending || waiting}>
      {pending ? 'Updating…' : waiting ? `Update now · ${formatCooldown(cooldownMs)}` : 'Update now'}
    </button>
  )
}
