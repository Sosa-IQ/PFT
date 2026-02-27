import type { Transaction } from '@/lib/api'

// Maps category keywords to Tailwind color classes for the tag badge.
const CATEGORY_COLORS: Record<string, string> = {
  food: 'bg-orange-100 text-orange-700',
  dining: 'bg-orange-100 text-orange-700',
  restaurant: 'bg-orange-100 text-orange-700',
  groceries: 'bg-green-100 text-green-700',
  grocery: 'bg-green-100 text-green-700',
  shopping: 'bg-blue-100 text-blue-700',
  transport: 'bg-purple-100 text-purple-700',
  travel: 'bg-purple-100 text-purple-700',
  housing: 'bg-yellow-100 text-yellow-700',
  rent: 'bg-yellow-100 text-yellow-700',
  utilities: 'bg-gray-100 text-gray-700',
  entertainment: 'bg-pink-100 text-pink-700',
  health: 'bg-red-100 text-red-700',
  medical: 'bg-red-100 text-red-700',
  income: 'bg-emerald-100 text-emerald-700',
}

function tagStyle(cat: string | null): string {
  if (!cat) return 'bg-gray-100 text-gray-500'
  const key = cat.toLowerCase()
  for (const k of Object.keys(CATEGORY_COLORS)) {
    if (key.includes(k)) return CATEGORY_COLORS[k]
  }
  return 'bg-slate-100 text-slate-600'
}

interface Props {
  transactions: Transaction[]
}

export default function TransactionTable({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-10 text-center">No transactions found.</p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Merchant</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Account</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
            <th className="text-right px-4 py-3 font-medium text-gray-500">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr
              key={t.id}
              className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
            >
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                {new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </td>
              <td className="px-4 py-3 text-gray-800">
                <span className="font-medium">{t.merchant_name ?? '—'}</span>
                {t.is_recurring && (
                  <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                    recurring
                  </span>
                )}
                {t.note && (
                  <span className="ml-2 text-xs text-gray-400 italic">{t.note}</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
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
                  <span className="text-gray-300 text-xs">uncategorized</span>
                )}
              </td>
              <td
                className={`px-4 py-3 text-right font-medium tabular-nums ${
                  t.amount < 0 ? 'text-green-600' : 'text-gray-800'
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
