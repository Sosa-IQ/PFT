import type { Transaction } from '@/lib/api'
import { getCategoryBadge, type BadgeProps } from '@/lib/categories'

interface Props {
  transactions: Transaction[]
  // Optional map of category name → color key from the user's categories table.
  // When provided, stored colors take precedence over keyword-based matching.
  colorMap?: Record<string, string>
  // When provided, clicking a category badge (or the "uncategorized" label) opens
  // the recategorize flow for that transaction.
  onCategoryClick?: (tx: Transaction) => void
}

export default function TransactionTable({ transactions, colorMap, onCategoryClick }: Props) {
  if (transactions.length === 0) {
    return (
      <p className="text-sm text-cream-muted py-10 text-center">No transactions found.</p>
    )
  }

  return (
    <div className="app-panel overflow-x-auto rounded-2xl">
      <table className="w-full text-sm">
        <thead className="border-b border-surface-border bg-surface/80">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-cream-muted">Date</th>
            <th className="text-left px-4 py-3 font-medium text-cream-muted">Merchant</th>
            <th className="text-left px-4 py-3 font-medium text-cream-muted">Account</th>
            <th className="text-left px-4 py-3 font-medium text-cream-muted">Category</th>
            <th className="text-right px-4 py-3 font-medium text-cream-muted">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr
              key={t.id}
              className="border-b border-surface-border last:border-0 hover:bg-surface-hover transition-colors"
            >
              <td className="px-4 py-3 text-cream-muted whitespace-nowrap">
                {new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </td>
              <td className="px-4 py-3 text-cream">
                <span className="font-medium">{t.merchant_name ?? '—'}</span>
                {t.is_recurring && (
                  <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent-text dark:text-accent">
                    recurring
                  </span>
                )}
                {t.note && (
                  <span className="ml-2 text-xs text-cream-muted italic">{t.note}</span>
                )}
              </td>
              <td className="px-4 py-3 text-cream-muted text-xs whitespace-nowrap">
                {t.account_name ?? '—'}
              </td>
              <td className="px-4 py-3">
                {t.category ? (
                  (() => {
                    const { className, style } = getCategoryBadge(t.category, colorMap)
                    return onCategoryClick ? (
                      <button
                        type="button"
                        onClick={() => onCategoryClick(t)}
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-opacity hover:opacity-75 ${className}`}
                        style={style}
                        title="Edit category"
                      >
                        {t.category}
                      </button>
                    ) : (
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
                        style={style}
                      >
                        {t.category}
                      </span>
                    )
                  })()
                ) : onCategoryClick ? (
                  <button
                    type="button"
                    onClick={() => onCategoryClick(t)}
                    className="text-cream-muted/50 text-xs hover:text-accent transition-colors"
                    title="Add category"
                  >
                    + Add category
                  </button>
                ) : (
                  <span className="text-cream-muted text-xs">uncategorized</span>
                )}
              </td>
              <td
                className={`px-4 py-3 text-right font-medium tabular-nums ${
                  t.amount < 0 ? 'text-accent-text dark:text-accent' : 'text-warning'
                }`}
              >
                {t.amount < 0 ? '+' : ''}$
                {Math.abs(t.amount).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
