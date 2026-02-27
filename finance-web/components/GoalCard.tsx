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
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-800">{name}</span>
        <div className="flex gap-3">
          {onEdit && (
            <button onClick={onEdit} className="text-xs text-blue-500 hover:underline">
              Edit
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="text-xs text-red-400 hover:underline">
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Amounts */}
      <div className="flex justify-between text-sm">
        <span className="text-gray-700">
          ${current_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="text-gray-400">
          of ${target_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-green-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center">
        <p className="text-xs font-medium text-green-600">{pct.toFixed(0)}% complete</p>
        {pct < 100 && (
          <p className="text-xs text-gray-400">
            ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to go
          </p>
        )}
      </div>

      {deadline && (
        <p className="text-xs text-gray-400">
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
