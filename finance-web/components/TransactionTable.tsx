import type { Transaction } from '@/lib/api'

// Maps category keywords to Tailwind color classes for the tag badge.
const CATEGORY_COLORS: Record<string, string> = {
  food: 'bg-[#efe5ff] text-[#7c4fd6] dark:bg-[#312548] dark:text-[#cf9bff]',
  dining: 'bg-[#efe5ff] text-[#7c4fd6] dark:bg-[#312548] dark:text-[#cf9bff]',
  restaurant: 'bg-[#efe5ff] text-[#7c4fd6] dark:bg-[#312548] dark:text-[#cf9bff]',
  groceries: 'bg-[#e3f6ed] text-[#239b73] dark:bg-[#153729] dark:text-accent',
  grocery: 'bg-[#e3f6ed] text-[#239b73] dark:bg-[#153729] dark:text-accent',
  shopping: 'bg-[#fde8e7] text-[#c96672] dark:bg-[#3c2430] dark:text-danger',
  transport: 'bg-[#e2f1ff] text-[#2a7db4] dark:bg-[#22344f] dark:text-[#78d7ff]',
  travel: 'bg-[#e2f1ff] text-[#2a7db4] dark:bg-[#22344f] dark:text-[#78d7ff]',
  housing: 'bg-[#fbf2d7] text-[#b68a22] dark:bg-[#3d3622] dark:text-warning',
  rent: 'bg-[#fbf2d7] text-[#b68a22] dark:bg-[#3d3622] dark:text-warning',
  utilities: 'bg-[#e8edf6] text-[#697792] dark:bg-[#27324a] dark:text-cream-muted',
  entertainment: 'bg-[#efe5ff] text-[#7c4fd6] dark:bg-[#312548] dark:text-[#cf9bff]',
  health: 'bg-[#fde8e7] text-[#c96672] dark:bg-[#3c2430] dark:text-danger',
  medical: 'bg-[#fde8e7] text-[#c96672] dark:bg-[#3c2430] dark:text-danger',
  income: 'bg-[#e3f6ed] text-[#239b73] dark:bg-[#153729] dark:text-accent',
}

function tagStyle(cat: string | null): string {
  if (!cat) return 'bg-[#e8edf6] text-[#697792] dark:bg-[#27324a] dark:text-cream-muted'
  const key = cat.toLowerCase()
  for (const k of Object.keys(CATEGORY_COLORS)) {
    if (key.includes(k)) return CATEGORY_COLORS[k]
  }
  return 'bg-[#e8edf6] text-[#697792] dark:bg-[#27324a] dark:text-cream-muted'
}

interface Props {
  transactions: Transaction[]
}

export default function TransactionTable({ transactions }: Props) {
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
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${tagStyle(t.category)}`}
                  >
                    {t.category}
                  </span>
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
