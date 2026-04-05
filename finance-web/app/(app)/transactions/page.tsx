'use client'

import { useState } from 'react'
import { useTransactions, useCategories } from '@/hooks/queries'
import type { Transaction } from '@/lib/api'
import TransactionTable from '@/components/TransactionTable'
import RecategorizeModal from '@/components/RecategorizeModal'

export default function TransactionsPage() {
  const [editTarget, setEditTarget] = useState<Transaction | null>(null)

  // Filter state
  const [category, setCategory] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [limit, setLimit] = useState(100)

  // "Applied" filters — only sent to the query when the user clicks Apply.
  const [appliedFilters, setAppliedFilters] = useState<{
    category?: string
    start_date?: string
    end_date?: string
    limit: number
  }>({ limit: 100 })

  const { data: transactions = [], isLoading, error } = useTransactions(appliedFilters)
  const { data: categories = [] } = useCategories()
  const colorMap = Object.fromEntries(
    categories.filter((c) => c.color).map((c) => [c.name, c.color!]),
  )

  function handleApply() {
    setAppliedFilters({
      category: category || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      limit,
    })
  }

  function handleReset() {
    setCategory('')
    setStartDate('')
    setEndDate('')
    setLimit(100)
    setAppliedFilters({ limit: 100 })
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-cream">Transactions</h1>

      {/* Filters */}
      <div className="app-panel rounded-2xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-cream-muted mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. groceries"
              className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm bg-surface text-cream focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-cream-muted mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm bg-surface text-cream focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-cream-muted mb-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm bg-surface text-cream focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-cream-muted mb-1">Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm bg-surface text-cream focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-3">
          <button
            onClick={handleApply}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
          >
            Apply filters
          </button>
          <button
            onClick={handleReset}
            className="text-cream-muted rounded-lg px-4 py-2 text-sm hover:bg-surface-hover transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error instanceof Error ? error.message : 'Failed to load transactions'}
        </div>
      )}

      {/* Results */}
      <div>
        {isLoading ? (
          <p className="text-cream-muted text-sm py-10 text-center">Loading…</p>
        ) : (
          <>
            <p className="text-xs text-cream-muted mb-3">{transactions.length} transaction(s)</p>
            <TransactionTable
              transactions={transactions}
              colorMap={colorMap}
              onCategoryClick={setEditTarget}
            />
          </>
        )}
      </div>

      <RecategorizeModal
        key={editTarget?.id}
        transaction={editTarget}
        onClose={() => setEditTarget(null)}
      />
    </div>
  )
}
