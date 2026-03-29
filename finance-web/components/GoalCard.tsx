interface Props {
  id: string
  name: string
  target_amount: number
  current_amount: number
  deadline: string | null
  onEdit?: () => void
  onDelete?: () => void
}

export default function GoalCard({
  name,
  target_amount,
  current_amount,
  deadline,
  onEdit,
  onDelete,
}: Props) {
  const pct = Math.min((current_amount / target_amount) * 100, 100)
  const remaining = Math.max(target_amount - current_amount, 0)

  return (
    <div className="app-panel rounded-2xl p-5 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-medium text-cream">{name}</span>
        <div className="flex gap-3">
          {onEdit && (
            <button onClick={onEdit} className="text-xs text-accent-text dark:text-accent hover:underline">
              Edit
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="text-xs text-danger hover:underline">
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Amounts */}
      <div className="flex justify-between text-sm">
        <span className="text-cream">
          ${current_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="text-cream-muted">
          of ${target_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-surface overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center">
        <p className="text-xs font-medium text-accent-text dark:text-accent">{pct.toFixed(0)}% complete</p>
        {pct < 100 && (
          <p className="text-xs text-cream-muted">
            ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to go
          </p>
        )}
      </div>

      {deadline && (
        <p className="text-xs text-cream-muted">
          Target:{' '}
          {new Date(deadline + 'T00:00:00').toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      )}
    </div>
  )
}
