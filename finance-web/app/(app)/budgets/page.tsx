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
    <div className="app-panel relative flex items-center overflow-visible rounded-2xl">
      <button
        onClick={onClick}
        className="flex-1 flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-medium text-cream">{budget.name}</span>
        <div className="flex items-center gap-3">
          <span className={`text-base font-semibold ${positive ? 'text-accent' : 'text-warning'}`}>
            {formatCurrency(balance)}
          </span>
          <span className="text-cream-muted/50 text-lg">›</span>
        </div>
      </button>
      {/* Divider + kebab */}
      <div className="w-px h-10 bg-surface-border" />
      <div ref={menuRef} className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
          className="px-4 py-4 text-cream-muted hover:text-cream transition-colors text-lg"
          title="Options"
        >
          ⋮
        </button>
        {menuOpen && (
          <div className="app-panel absolute right-0 top-full z-50 mt-1 w-40 rounded-xl py-1 shadow-card">
            <button
              onClick={() => { setMenuOpen(false); onEditName() }}
              className="w-full text-left px-4 py-2.5 text-sm text-cream hover:bg-surface-hover transition-colors"
            >
              Edit Name
            </button>
            <button
              onClick={() => { setMenuOpen(false); onEditDate() }}
              className="w-full text-left px-4 py-2.5 text-sm text-cream hover:bg-surface-hover transition-colors"
            >
              Edit Date
            </button>
            <button
              onClick={() => { setMenuOpen(false); onDelete() }}
              className="w-full text-left px-4 py-2.5 text-sm text-danger transition-colors hover:bg-danger/10"
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="app-panel w-full space-y-5 rounded-t-3xl p-6 shadow-app sm:max-w-md sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-cream">Edit Name</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim()) }} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
            className="w-full border border-surface-border rounded-xl px-4 py-3 text-sm bg-surface text-cream focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-surface-border rounded-xl py-3 text-sm font-medium text-cream-muted hover:bg-surface-hover transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 rounded-xl bg-accent py-3 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover">
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="app-panel w-full space-y-5 rounded-t-3xl p-6 shadow-app sm:max-w-md sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-cream">Edit Date Range</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-xs font-medium text-cream-muted mb-2 uppercase tracking-wide">Period</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(['monthly', 'weekly', 'biweekly', 'custom'] as DateRangeType[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDateRangeType(r)}
                  className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                    dateRangeType === r
                      ? 'bg-accent border-accent text-accent-contrast'
                      : 'border-surface-border text-cream-muted hover:border-cream-muted'
                  }`}
                >
                  {DATE_RANGE_LABELS[r]}
                </button>
              ))}
            </div>
            {dateRangeType === 'custom' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <p className="text-xs text-cream-muted mb-1">Start</p>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
                    className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm bg-surface text-cream focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
                <div>
                  <p className="text-xs text-cream-muted mb-1">End</p>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required
                    className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm bg-surface text-cream focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
              </div>
            )}
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-surface-border rounded-xl py-3 text-sm font-medium text-cream-muted hover:bg-surface-hover transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 rounded-xl bg-accent py-3 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover">
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="app-panel w-full space-y-5 rounded-t-3xl p-6 shadow-app sm:max-w-md sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-cream">New Budget</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            placeholder="Budget name (e.g. August)"
            className="w-full border border-surface-border rounded-xl px-4 py-3 text-sm bg-surface text-cream placeholder:text-cream-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />

          {/* Date range */}
          <div>
            <p className="text-xs font-medium text-cream-muted mb-2 uppercase tracking-wide">Period</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(['monthly', 'weekly', 'biweekly', 'custom'] as DateRangeType[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDateRangeType(r)}
                  className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                    dateRangeType === r
                      ? 'bg-accent border-accent text-accent-contrast'
                      : 'border-surface-border text-cream-muted hover:border-cream-muted'
                  }`}
                >
                  {DATE_RANGE_LABELS[r]}
                </button>
              ))}
            </div>

            {dateRangeType === 'custom' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <p className="text-xs text-cream-muted mb-1">Start</p>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
                    className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm bg-surface text-cream focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
                <div>
                  <p className="text-xs text-cream-muted mb-1">End</p>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required
                    className="w-full border border-surface-border rounded-xl px-3 py-2 text-sm bg-surface text-cream focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-surface-border rounded-xl py-3 text-sm font-medium text-cream-muted hover:bg-surface-hover transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={createMut.isPending}
              className="flex-1 rounded-xl bg-accent py-3 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50">
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

  if (isLoading) return <p className="text-cream-muted text-sm text-center py-20">Loading…</p>

  return (
    <div className="max-w-lg mx-auto flex flex-col min-h-[calc(100vh-4rem)]">
      <h1 className="text-2xl font-semibold mb-5 text-cream">Budgets</h1>

      {(error || actionError) && (
        <p className="mb-3 text-sm text-danger">
          {error instanceof Error ? error.message : actionError}
        </p>
      )}

      <div className="flex-1 space-y-3">
        {budgets.length === 0 ? (
          <p className="text-cream-muted text-sm text-center py-16">
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
      <div className="sticky bottom-0 bg-surface/95 pb-4 pt-3 backdrop-blur">
        <button
          onClick={() => setShowModal(true)}
          className="w-full rounded-2xl bg-accent py-4 text-base font-semibold text-accent-contrast shadow-card transition-colors hover:bg-accent-hover"
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
