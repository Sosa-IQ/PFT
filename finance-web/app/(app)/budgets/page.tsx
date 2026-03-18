'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useBudgets, useCreateBudget, useDeleteBudget, useUpdateBudget } from '@/hooks/queries'
import type { Budget } from '@/lib/api'

type DateRangeType = 'monthly' | 'weekly' | 'biweekly' | 'custom'

const DATE_RANGE_LABELS: Record<DateRangeType, string> = {
  monthly: 'Monthly',
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  custom: 'Custom',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: 'exceptZero',
  }).format(n)
}

// ---------------------------------------------------------------------------
// Budget card — matches Fudget list item style
// ---------------------------------------------------------------------------

function BudgetCard({ budget, onClick, onDelete, onEditName, onEditDate }: {
  budget: Budget & { balance?: number }
  onClick: () => void
  onDelete: () => void
  onEditName: () => void
  onEditDate: () => void
}) {
  const balance = budget.balance ?? 0
  const positive = balance >= 0
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <div className="relative flex items-center bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible">
      <button
        onClick={onClick}
        className="flex-1 flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-medium text-gray-800">{budget.name}</span>
        <div className="flex items-center gap-3">
          <span className={`font-semibold text-base ${positive ? 'text-green-600' : 'text-orange-500'}`}>
            {formatCurrency(balance)}
          </span>
          <span className="text-gray-300 text-lg">›</span>
        </div>
      </button>
      {/* Divider + kebab */}
      <div className="w-px h-10 bg-gray-100" />
      <div ref={menuRef} className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
          className="px-4 py-4 text-gray-400 hover:text-gray-600 transition-colors text-lg"
          title="Options"
        >
          ⋮
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
            <button
              onClick={() => { setMenuOpen(false); onEditName() }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Edit Name
            </button>
            <button
              onClick={() => { setMenuOpen(false); onEditDate() }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Edit Date
            </button>
            <button
              onClick={() => { setMenuOpen(false); onDelete() }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Edit name modal
// ---------------------------------------------------------------------------

function EditNameModal({ budget, onClose, onSave }: {
  budget: Budget
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(budget.name)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-800">Edit Name</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim()) }} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 bg-blue-500 text-white rounded-xl py-3 text-sm font-medium hover:bg-blue-600 transition-colors">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Edit date modal
// ---------------------------------------------------------------------------

function EditDateModal({ budget, onClose, onSave }: {
  budget: Budget
  onClose: () => void
  onSave: (data: { date_range_type: DateRangeType; start_date?: string; end_date?: string }) => void
}) {
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>(budget.date_range_type as DateRangeType)
  const [startDate, setStartDate] = useState(budget.start_date ?? '')
  const [endDate, setEndDate] = useState(budget.end_date ?? '')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (dateRangeType === 'custom' && (!startDate || !endDate)) {
      setError('Start and end dates are required.')
      return
    }
    onSave({
      date_range_type: dateRangeType,
      ...(dateRangeType === 'custom' ? { start_date: startDate, end_date: endDate } : {}),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-800">Edit Date Range</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Period</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(['monthly', 'weekly', 'biweekly', 'custom'] as DateRangeType[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDateRangeType(r)}
                  className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                    dateRangeType === r
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {DATE_RANGE_LABELS[r]}
                </button>
              ))}
            </div>
            {dateRangeType === 'custom' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Start</p>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">End</p>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 bg-blue-500 text-white rounded-xl py-3 text-sm font-medium hover:bg-blue-600 transition-colors">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// New budget modal
// ---------------------------------------------------------------------------

function NewBudgetModal({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (budget: Budget) => void
}) {
  const createMut = useCreateBudget()
  const [name, setName] = useState('')
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>('monthly')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Name is required.'); return }
    if (dateRangeType === 'custom' && (!startDate || !endDate)) {
      setError('Start and end dates are required.')
      return
    }
    try {
      const budget = await createMut.mutateAsync({
        name: name.trim(),
        date_range_type: dateRangeType,
        ...(dateRangeType === 'custom' ? { start_date: startDate, end_date: endDate } : {}),
      })
      onCreate(budget)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create budget.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-800">New Budget</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            placeholder="Budget name (e.g. August)"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Date range */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Period</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(['monthly', 'weekly', 'biweekly', 'custom'] as DateRangeType[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDateRangeType(r)}
                  className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                    dateRangeType === r
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {DATE_RANGE_LABELS[r]}
                </button>
              ))}
            </div>

            {dateRangeType === 'custom' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Start</p>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">End</p>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={createMut.isPending}
              className="flex-1 bg-blue-500 text-white rounded-xl py-3 text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors">
              {createMut.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BudgetsPage() {
  const router = useRouter()
  const { data: budgets = [], isLoading, error } = useBudgets()
  const deleteMut = useDeleteBudget()
  const updateMut = useUpdateBudget()
  const [showModal, setShowModal] = useState(false)
  const [editingName, setEditingName] = useState<Budget | null>(null)
  const [editingDate, setEditingDate] = useState<Budget | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleDelete(budget: Budget) {
    if (!confirm(`Delete "${budget.name}"? All entries will be removed.`)) return
    try {
      await deleteMut.mutateAsync(budget.id)
    } catch {
      setActionError('Failed to delete budget.')
    }
  }

  async function handleEditName(budget: Budget, name: string) {
    try {
      await updateMut.mutateAsync({ id: budget.id, name })
      setEditingName(null)
    } catch {
      setActionError('Failed to update name.')
    }
  }

  async function handleEditDate(budget: Budget, data: { date_range_type: string; start_date?: string; end_date?: string }) {
    try {
      await updateMut.mutateAsync({ id: budget.id, ...data })
      setEditingDate(null)
    } catch {
      setActionError('Failed to update date range.')
    }
  }

  if (isLoading) return <p className="text-gray-400 text-sm text-center py-20">Loading…</p>

  return (
    <div className="max-w-lg mx-auto flex flex-col min-h-[calc(100vh-4rem)]">
      <h1 className="text-2xl font-semibold mb-5">Budgets</h1>

      {(error || actionError) && (
        <p className="text-sm text-red-500 mb-3">
          {error instanceof Error ? error.message : actionError}
        </p>
      )}

      <div className="flex-1 space-y-3">
        {budgets.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-16">
            No budgets yet. Tap Add Budget to create one.
          </p>
        ) : (
          budgets.map((b) => (
            <BudgetCard
              key={b.id}
              budget={b}
              onClick={() => router.push(`/budgets/${b.id}`)}
              onDelete={() => handleDelete(b)}
              onEditName={() => setEditingName(b)}
              onEditDate={() => setEditingDate(b)}
            />
          ))
        )}
      </div>

      {/* Sticky add button */}
      <div className="sticky bottom-0 pb-4 pt-3 bg-gray-50">
        <button
          onClick={() => setShowModal(true)}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-2xl py-4 text-base font-semibold shadow-md transition-colors"
        >
          Add Budget
        </button>
      </div>

      {showModal && (
        <NewBudgetModal
          onClose={() => setShowModal(false)}
          onCreate={(budget) => {
            setShowModal(false)
            router.push(`/budgets/${budget.id}`)
          }}
        />
      )}

      {editingName && (
        <EditNameModal
          budget={editingName}
          onClose={() => setEditingName(null)}
          onSave={(name) => handleEditName(editingName, name)}
        />
      )}

      {editingDate && (
        <EditDateModal
          budget={editingDate}
          onClose={() => setEditingDate(null)}
          onSave={(data) => handleEditDate(editingDate, data)}
        />
      )}
    </div>
  )
}
