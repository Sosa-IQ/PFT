'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  useBudgets,
  useBudgetLines,
  useCreateBudgetLine,
  useUpdateBudgetLine,
  useDeleteBudgetLine,
  useUpdateBudget,
  useTransactionCategories,
  queryKeys,
} from '@/hooks/queries'
import type { Budget, BudgetLine } from '@/lib/api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DATE_RANGE_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  custom: 'Custom',
}

type DateRangeType = 'monthly' | 'weekly' | 'biweekly' | 'custom'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

// ---------------------------------------------------------------------------
// Multi-select category picker dropdown
// ---------------------------------------------------------------------------

function CategoryPicker({
  selected,
  options,
  onChange,
}: {
  selected: string[]
  options: string[]
  onChange: (cats: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectedLower = selected.map((s) => s.toLowerCase())

  function isSelected(cat: string) {
    return selectedLower.includes(cat.toLowerCase())
  }

  function toggle(cat: string) {
    const catLower = cat.toLowerCase()
    if (isSelected(cat)) {
      onChange(selected.filter((c) => c.toLowerCase() !== catLower))
    } else {
      onChange([...selected, catLower])
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5 hover:border-gray-300 truncate max-w-[9rem]"
      >
        {selected.length === 0
          ? 'link categories'
          : selected.length === 1
            ? selected[0]
            : `${selected.length} categories`}
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[12rem] w-max max-h-52 overflow-y-auto">
          {options.length === 0 && (
            <p className="text-xs text-gray-400 px-3 py-2">No categories found</p>
          )}
          {options.map((c) => (
            <button
              key={c}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 capitalize flex items-center gap-2 whitespace-nowrap"
              onClick={() => toggle(c)}
            >
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${
                isSelected(c)
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'border-gray-300'
              }`}>
                {isSelected(c) && '✓'}
              </span>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Progress bar for lines with linked categories
// ---------------------------------------------------------------------------

function ProgressBar({ spent, planned, isIncome }: { spent: number; planned: number; isIncome: boolean }) {
  const pct = planned > 0 ? Math.min((spent / planned) * 100, 100) : 0
  const over = planned > 0 && spent > planned

  const barColor = isIncome
    ? 'bg-green-400'
    : over
      ? 'bg-red-400'
      : 'bg-blue-400'

  return (
    <div className="w-full mt-1">
      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
        <span>{fmt(spent)} of {fmt(planned)}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline add row — appears at the bottom of a section
// ---------------------------------------------------------------------------

interface InlineRowProps {
  lineType: 'income' | 'expense'
  allCategories: string[]
  onSave: (data: {
    name: string
    planned_amount: number
    categories: string[]
  }) => void | Promise<void>
  onCancel: () => void
}

function InlineRow({ lineType, allCategories, onSave, onCancel }: InlineRowProps) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const isIncome = lineType === 'income'

  useEffect(() => { nameRef.current?.focus() }, [])

  async function handleSave() {
    if (!name.trim()) return
    const amt = amount.trim() === '' ? 0 : parseFloat(amount)
    if (isNaN(amt) || amt < 0) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        planned_amount: amt,
        categories,
      })
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') onCancel()
  }

  const borderColor = isIncome ? 'border-green-400' : 'border-red-400'
  const textColor = isIncome ? 'text-green-600' : 'text-red-500'

  return (
    <div className={`flex items-center gap-2 px-4 py-3 border-l-4 ${borderColor} bg-white`}>
      <input
        ref={nameRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isIncome ? 'Income name' : 'Expense name'}
        className={`flex-1 text-sm font-medium bg-transparent border-b border-gray-200 outline-none pb-0.5 ${textColor} placeholder:text-gray-300`}
      />

      <CategoryPicker selected={categories} options={allCategories} onChange={setCategories} />

      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={handleKeyDown}
        min="0"
        step="0.01"
        placeholder="0.00"
        className={`w-24 text-right text-sm font-semibold bg-transparent border-b border-gray-200 outline-none pb-0.5 ${textColor} placeholder:text-gray-300`}
      />

      <button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="text-green-500 hover:text-green-600 disabled:opacity-30 font-bold text-lg leading-none"
        title="Save"
      >
        ✓
      </button>
      <button onClick={onCancel} className="text-gray-300 hover:text-gray-500 font-bold text-lg leading-none" title="Cancel">
        ✕
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Line row — click name or amount to edit inline, with optional progress bar
// ---------------------------------------------------------------------------

function LineRow({ line, allCategories, onSave, onDelete }: {
  line: BudgetLine
  allCategories: string[]
  onSave: (data: { name: string; planned_amount: number; categories: string[] }) => Promise<void>
  onDelete: () => void
}) {
  const isIncome = line.line_type === 'income'

  const [displayName, setDisplayName] = useState(line.name)
  const [displayAmount, setDisplayAmount] = useState(line.planned_amount)
  const [displayCategories, setDisplayCategories] = useState<string[]>(line.categories)

  const [editingName, setEditingName] = useState(false)
  const [editingAmount, setEditingAmount] = useState(false)
  const [nameVal, setNameVal] = useState(line.name)
  const [amountVal, setAmountVal] = useState(String(line.planned_amount))
  const nameInputRef = useRef<HTMLInputElement>(null)
  const amountInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editingName) { setDisplayName(line.name); setNameVal(line.name) }
  }, [line.name, editingName])

  useEffect(() => {
    if (!editingAmount) {
      setDisplayAmount(line.planned_amount)
      setAmountVal(String(line.planned_amount))
    }
  }, [line.planned_amount, editingAmount])

  useEffect(() => {
    setDisplayCategories(line.categories)
  }, [line.categories])

  useEffect(() => { if (editingName) nameInputRef.current?.select() }, [editingName])
  useEffect(() => { if (editingAmount) amountInputRef.current?.select() }, [editingAmount])

  async function commitName() {
    const trimmed = nameVal.trim()
    if (!trimmed || trimmed === displayName) { setEditingName(false); return }
    setDisplayName(trimmed)
    setEditingName(false)
    try {
      await onSave({ name: trimmed, planned_amount: displayAmount, categories: displayCategories })
    } catch {
      setDisplayName(line.name)
    }
  }

  async function commitAmount() {
    const parsed = parseFloat(amountVal)
    if (isNaN(parsed) || parsed < 0 || parsed === displayAmount) { setEditingAmount(false); return }
    setDisplayAmount(parsed)
    setEditingAmount(false)
    try {
      await onSave({ name: displayName, planned_amount: parsed, categories: displayCategories })
    } catch {
      setDisplayAmount(line.planned_amount)
    }
  }

  async function handleCategoriesChange(cats: string[]) {
    setDisplayCategories(cats)
    try {
      await onSave({ name: displayName, planned_amount: displayAmount, categories: cats })
    } catch {
      setDisplayCategories(line.categories)
    }
  }

  function handleNameKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.currentTarget.blur() }
    if (e.key === 'Escape') { setNameVal(displayName); setEditingName(false) }
  }

  function handleAmountKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.currentTarget.blur() }
    if (e.key === 'Escape') { setAmountVal(String(displayAmount)); setEditingAmount(false) }
  }

  const nameColor = isIncome ? 'text-green-700' : 'text-red-600'
  const amountColor = isIncome ? 'text-green-600' : 'text-red-500'
  const hasProgress = displayCategories.length > 0 && line.computed_actual != null

  return (
    <div className="border-b border-gray-100 last:border-0 group">
      <div className="flex items-center">
        {/* Name — click to edit */}
        <div className="flex-1 flex items-center px-4 py-3.5 gap-2 min-w-0">
          {editingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onBlur={commitName}
              onKeyDown={handleNameKey}
              className={`flex-1 text-sm font-medium bg-transparent border-b border-gray-300 outline-none pb-0.5 ${nameColor}`}
            />
          ) : (
            <span
              onClick={() => setEditingName(true)}
              className={`text-sm font-medium cursor-text select-none ${nameColor} hover:underline underline-offset-2 decoration-dashed`}
            >
              {displayName}
            </span>
          )}
          {!editingName && (
            <CategoryPicker selected={displayCategories} options={allCategories} onChange={handleCategoriesChange} />
          )}
        </div>

        {/* Amount — click to edit */}
        <div className="px-2 py-3.5">
          {editingAmount ? (
            <input
              ref={amountInputRef}
              type="number"
              value={amountVal}
              onChange={(e) => setAmountVal(e.target.value)}
              onBlur={commitAmount}
              onKeyDown={handleAmountKey}
              min="0"
              step="0.01"
              className={`w-24 text-right text-sm font-semibold bg-transparent border-b border-gray-300 outline-none pb-0.5 ${amountColor}`}
            />
          ) : (
            <span
              onClick={() => setEditingAmount(true)}
              className={`text-sm font-semibold tabular-nums cursor-text select-none ${amountColor} hover:underline underline-offset-2 decoration-dashed`}
            >
              {isIncome ? '+' : '-'} {fmt(displayAmount)}
            </span>
          )}
        </div>

        {/* Delete button */}
        <div className="relative px-1">
          <button
            onClick={onDelete}
            className="px-2 py-3 text-gray-200 hover:text-red-400 transition-colors text-base opacity-0 group-hover:opacity-100"
            title="Delete"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Progress bar — only for lines with linked categories */}
      {hasProgress && (
        <div className="px-4 pb-3 -mt-1">
          <ProgressBar spent={line.computed_actual!} planned={line.planned_amount} isIncome={isIncome} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Period editor — inline edit for budget date range
// ---------------------------------------------------------------------------

function PeriodBadge({ budget }: { budget: Budget }) {
  const [editing, setEditing] = useState(false)
  const [rangeType, setRangeType] = useState<DateRangeType>(budget.date_range_type)
  const [startDate, setStartDate] = useState(budget.start_date ?? '')
  const [endDate, setEndDate] = useState(budget.end_date ?? '')
  const updateMut = useUpdateBudget()

  async function save() {
    const data: Record<string, string> = { date_range_type: rangeType }
    if (rangeType === 'custom') {
      if (!startDate || !endDate) return
      data.start_date = startDate
      data.end_date = endDate
    }
    await updateMut.mutateAsync({ id: budget.id, ...data })
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full hover:bg-gray-200 transition-colors"
      >
        {DATE_RANGE_LABELS[budget.date_range_type] ?? budget.date_range_type}
        {budget.date_range_type === 'custom' && budget.start_date && budget.end_date
          ? ` · ${budget.start_date} → ${budget.end_date}`
          : ''}
      </button>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 absolute right-0 top-8 z-20 w-64 space-y-3">
      <div className="grid grid-cols-2 gap-1.5">
        {(['monthly', 'weekly', 'biweekly', 'custom'] as DateRangeType[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRangeType(r)}
            className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
              rangeType === r
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {DATE_RANGE_LABELS[r]}
          </button>
        ))}
      </div>
      {rangeType === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs" />
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => setEditing(false)} className="flex-1 text-xs text-gray-500 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50">Cancel</button>
        <button onClick={save} disabled={updateMut.isPending} className="flex-1 text-xs text-white bg-blue-500 rounded-lg py-1.5 hover:bg-blue-600 disabled:opacity-50">Save</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BudgetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: budgets = [], isLoading: loadingBudgets } = useBudgets()
  const { data: lines = [], isLoading: loadingLines } = useBudgetLines(id)
  const { data: categories = [] } = useTransactionCategories()

  const qc = useQueryClient()
  const createMut = useCreateBudgetLine(id)
  const updateMut = useUpdateBudgetLine(id)
  const deleteMut = useDeleteBudgetLine(id)

  const [adding, setAdding] = useState<'income' | 'expense' | null>(null)
  const linesKey = [...queryKeys.budgets, id, 'lines']

  const budget = budgets.find((b) => b.id === id) as Budget | undefined

  if (loadingBudgets || loadingLines) {
    return <p className="text-gray-400 text-sm text-center py-20">Loading…</p>
  }

  if (!budget) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-gray-400 text-sm">Budget not found.</p>
        <button onClick={() => router.push('/budgets')} className="text-blue-500 text-sm hover:underline">
          ← Back
        </button>
      </div>
    )
  }

  const incomeLines = lines.filter((l) => l.line_type === 'income')
  const expenseLines = lines.filter((l) => l.line_type === 'expense')

  const totalIncome = incomeLines.reduce((s, l) => s + l.planned_amount, 0)
  const totalExpenses = expenseLines.reduce((s, l) => s + l.planned_amount, 0)
  const balance = totalIncome - totalExpenses

  function handleAdd(lineType: 'income' | 'expense', data: {
    name: string; planned_amount: number; categories: string[]
  }) {
    const tempId = `temp-${Date.now()}`
    const optimistic: BudgetLine = {
      id: tempId,
      budget_id: id,
      line_type: lineType,
      name: data.name,
      categories: data.categories,
      planned_amount: data.planned_amount,
      computed_actual: null,
    }
    qc.setQueryData<BudgetLine[]>(linesKey, (old) => [...(old ?? []), optimistic])
    setAdding(null)

    const mutationData = {
      line_type: lineType,
      name: data.name,
      planned_amount: data.planned_amount,
      ...(data.categories.length > 0 ? { categories: data.categories } : {}),
    }
    createMut.mutate(mutationData, {
      onSuccess: (created) => {
        qc.setQueryData<BudgetLine[]>(linesKey, (old) =>
          (old ?? []).map((l) => l.id === tempId ? created : l)
        )
      },
      onError: () => {
        qc.setQueryData<BudgetLine[]>(linesKey, (old) =>
          (old ?? []).filter((l) => l.id !== tempId)
        )
      },
      onSettled: () => {
        qc.invalidateQueries({ queryKey: linesKey })
      },
    })
  }

  async function handleEdit(line: BudgetLine, data: {
    name: string; planned_amount: number; categories: string[]
  }) {
    await updateMut.mutateAsync({
      id: line.id,
      name: data.name,
      planned_amount: data.planned_amount,
      categories: data.categories,
    })
  }

  async function handleDelete(line: BudgetLine) {
    if (!confirm(`Remove "${line.name}"?`)) return
    await deleteMut.mutateAsync(line.id)
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => router.push('/budgets')} className="text-gray-400 hover:text-gray-600 text-sm">
          ← Budgets
        </button>
      </div>
      <div className="flex items-baseline justify-between mb-4 relative">
        <h1 className="text-2xl font-semibold">{budget.name}</h1>
        <PeriodBadge budget={budget} />
      </div>

      {/* Lines list */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        {incomeLines.length === 0 && expenseLines.length === 0 && !adding ? (
          <p className="text-sm text-gray-400 text-center py-12">
            No entries yet. Add income or expenses below.
          </p>
        ) : (
          <>
            {/* Income lines */}
            {incomeLines.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                allCategories={categories}
                onSave={(data) => handleEdit(line, data)}
                onDelete={() => handleDelete(line)}
              />
            ))}

            {/* Inline add row for income */}
            {adding === 'income' && (
              <InlineRow
                lineType="income"
                allCategories={categories}
                onSave={(data) => handleAdd('income', data)}
                onCancel={() => setAdding(null)}
              />
            )}

            {/* Divider between income and expenses */}
            {incomeLines.length > 0 && (expenseLines.length > 0 || adding === 'expense') && (
              <div className="h-px bg-gray-200 mx-4" />
            )}

            {/* Expense lines */}
            {expenseLines.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                allCategories={categories}
                onSave={(data) => handleEdit(line, data)}
                onDelete={() => handleDelete(line)}
              />
            ))}

            {/* Inline add row for expense */}
            {adding === 'expense' && (
              <InlineRow
                lineType="expense"
                allCategories={categories}
                onSave={(data) => handleAdd('expense', data)}
                onCancel={() => setAdding(null)}
              />
            )}
          </>
        )}
      </div>

      {/* Bottom section */}
      <div className="sticky bottom-0 space-y-3 pb-4 pt-1 bg-gray-50">
        {/* Add buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setAdding('income')}
            className="bg-green-500 hover:bg-green-600 text-white rounded-2xl py-3.5 text-sm font-semibold shadow-sm transition-colors"
          >
            Add Income
          </button>
          <button
            onClick={() => setAdding('expense')}
            className="bg-red-500 hover:bg-red-600 text-white rounded-2xl py-3.5 text-sm font-semibold shadow-sm transition-colors"
          >
            Add Expense
          </button>
        </div>

        {/* Summary bar */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Income</p>
            <p className="text-sm font-semibold text-green-600">+{fmt(totalIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Expenses</p>
            <p className="text-sm font-semibold text-red-500">-{fmt(totalExpenses)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Balance</p>
            <p className={`text-sm font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {balance >= 0 ? '+' : ''}{fmt(balance)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
