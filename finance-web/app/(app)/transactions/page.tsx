'use client'

import { useState } from 'react'
import { useTransactions } from '@/hooks/queries'
import TransactionTable from '@/components/TransactionTable'

export default function TransactionsPage() {
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
      <h1 className="text-2xl font-semibold">Transactions</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. groceries"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Apply filters
          </button>
          <button
            onClick={handleReset}
            className="text-gray-500 rounded-lg px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {error instanceof Error ? error.message : 'Failed to load transactions'}
        </div>
      )}

      {/* Results */}
      <div>
        {isLoading ? (
          <p className="text-gray-400 text-sm py-10 text-center">Loading…</p>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-3">{transactions.length} transaction(s)</p>
            <TransactionTable transactions={transactions} />
          </>
        )}
      </div>
    </div>
  )
}
