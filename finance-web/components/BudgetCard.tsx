interface Props {
  category: string
  monthly_limit: number
  spent: number
  onEdit?: () => void
  onDelete?: () => void
}

export default function BudgetCard({ category, monthly_limit, spent, onEdit, onDelete }: Props) {
  const pct = Math.min((spent / monthly_limit) * 100, 100)
  const over = spent > monthly_limit

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-800 capitalize">{category}</span>
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
        <span className={over ? 'text-red-600 font-medium' : 'text-gray-700'}>
          ${spent.toFixed(2)} spent
        </span>
        <span className="text-gray-400">${monthly_limit.toFixed(2)} limit</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            over ? 'bg-red-500' : pct > 75 ? 'bg-yellow-400' : 'bg-blue-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Remaining / over */}
      <p className="text-xs text-gray-400 text-right">
        {over
          ? `$${(spent - monthly_limit).toFixed(2)} over budget`
          : `$${(monthly_limit - spent).toFixed(2)} remaining`}
      </p>
    </div>
  )
}
