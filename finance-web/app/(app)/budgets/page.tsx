'use client'

import { useState } from 'react'
import { useBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget, useTransactions } from '@/hooks/queries'
import type { Budget, Transaction } from '@/lib/api'
import BudgetCard from '@/components/BudgetCard'

// Returns "YYYY-MM-DD" for the first and last day of the current month.
function currentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

// Sum transactions for a given category (debits only).
function spentForCategory(txns: Transaction[], category: string): number {
  return txns
    .filter((t) => t.category?.toLowerCase() === category.toLowerCase() && t.amount > 0)
    .reduce((s, t) => s + t.amount, 0)
}

const { start, end } = currentMonthRange()

export default function BudgetsPage() {
  const { data: budgets = [], isLoading: loadingBudgets, error: budgetError } = useBudgets()
  const { data: transactions = [], isLoading: loadingTxns } = useTransactions({
    start_date: start,
    end_date: end,
    limit: 500,
  })

  const createBudgetMut = useCreateBudget()
  const updateBudgetMut = useUpdateBudget()
  const deleteBudgetMut = useDeleteBudget()

  // Add / Edit form state
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [formCategory, setFormCategory] = useState('')
  const [formLimit, setFormLimit] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function openAdd() {
    setEditingCategory(null)
    setFormCategory('')
    setFormLimit('')
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(budget: Budget) {
    setEditingCategory(budget.category)
    setFormCategory(budget.category)
    setFormLimit(String(budget.monthly_limit))
    setFormError(null)
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const limit = parseFloat(formLimit)
    if (isNaN(limit) || limit <= 0) {
      setFormError('Limit must be a positive number.')
      return
    }
    try {
      if (editingCategory) {
        await updateBudgetMut.mutateAsync({ category: editingCategory, monthly_limit: limit })
      } else {
        await createBudgetMut.mutateAsync({ category: formCategory.trim(), monthly_limit: limit })
      }
      setShowForm(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function handleDelete(category: string) {
    if (!confirm(`Delete budget for "${category}"?`)) return
    try {
      await deleteBudgetMut.mutateAsync(category)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const saving = createBudgetMut.isPending || updateBudgetMut.isPending
  const loading = loadingBudgets || loadingTxns

  if (loading) return <p className="text-gray-400 text-sm py-16 text-center">Loading…</p>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Budgets</h1>
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Add Budget
        </button>
      </div>

      {(budgetError || error) && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {budgetError instanceof Error ? budgetError.message : error}
        </div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSave}
          className="bg-white rounded-xl border border-gray-200 p-5 space-y-4"
        >
          <h2 className="font-semibold text-gray-800">
            {editingCategory ? `Edit "${editingCategory}"` : 'New Budget'}
          </h2>

          {!editingCategory && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                required
                placeholder="e.g. groceries"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Limit ($)</label>
            <input
              type="number"
              value={formLimit}
              onChange={(e) => setFormLimit(e.target.value)}
              required
              min="0.01"
              step="0.01"
              placeholder="500.00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {formError && <p className="text-sm text-red-500">{formError}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-gray-500 rounded-lg px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Budget Cards */}
      {budgets.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">
          No budgets yet. Add one to start tracking your spending limits.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {budgets.map((b) => (
            <BudgetCard
              key={b.category}
              category={b.category}
              monthly_limit={b.monthly_limit}
              spent={spentForCategory(transactions, b.category)}
              onEdit={() => openEdit(b)}
              onDelete={() => handleDelete(b.category)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
