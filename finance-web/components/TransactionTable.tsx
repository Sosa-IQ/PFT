import type { Transaction } from '@/lib/api'

// Maps category keywords to Tailwind color classes for the tag badge.
const CATEGORY_COLORS: Record<string, string> = {
  food: 'bg-[#312548] text-[#cf9bff]',
  dining: 'bg-[#312548] text-[#cf9bff]',
  restaurant: 'bg-[#312548] text-[#cf9bff]',
  groceries: 'bg-[#153729] text-accent',
  grocery: 'bg-[#153729] text-accent',
  shopping: 'bg-[#3c2430] text-danger',
  transport: 'bg-[#22344f] text-[#78d7ff]',
  travel: 'bg-[#22344f] text-[#78d7ff]',
  housing: 'bg-[#3d3622] text-warning',
  rent: 'bg-[#3d3622] text-warning',
  utilities: 'bg-[#27324a] text-cream-muted',
  entertainment: 'bg-[#312548] text-[#cf9bff]',
  health: 'bg-[#3c2430] text-danger',
  medical: 'bg-[#3c2430] text-danger',
  income: 'bg-[#153729] text-accent',
}

function tagStyle(cat: string | null): string {
  if (!cat) return 'bg-[#27324a] text-cream-muted'
  const key = cat.toLowerCase()
  for (const k of Object.keys(CATEGORY_COLORS)) {
    if (key.includes(k)) return CATEGORY_COLORS[k]
  }
  return 'bg-[#27324a] text-cream-muted'
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
                  <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
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
                  t.amount < 0 ? 'text-accent' : 'text-warning'
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
