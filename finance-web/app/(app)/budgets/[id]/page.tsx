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
  useReorderBudgetLines,
  useUpdateBudget,
  useTransactionCategories,
  useTransactions,
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

// Mirrors the backend _current_period helper so the frontend can fetch
// transactions for a budget's active date range without an extra API call.
function getBudgetPeriod(budget: Budget): { start: string; end: string } {
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  if (budget.date_range_type === 'custom') {
    return { start: budget.start_date!, end: budget.end_date! }
  }
  if (budget.date_range_type === 'weekly') {
    const day = today.getDay()
    const mon = new Date(today)
    mon.setDate(today.getDate() - ((day + 6) % 7)) // back to Monday
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    return { start: fmtDate(mon), end: fmtDate(sun) }
  }
  if (budget.date_range_type === 'biweekly') {
    const start = new Date(today)
    start.setDate(today.getDate() - 13)
    return { start: fmtDate(start), end: fmtDate(today) }
  }
  // monthly
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return { start: fmtDate(start), end: fmtDate(end) }
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
              <span className={`w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center text-[10px] ${
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
  const pct = planned > 0 ? (spent / planned) * 100 : 0
  const over = planned > 0 && spent > planned
  const diff = over ? spent - planned : 0

  const barColor = isIncome
    ? 'bg-green-400'
    : over
      ? 'bg-red-400'
      : 'bg-blue-400'

  return (
    <div className="w-full mt-1">
      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
        <span>
          {fmt(spent)} of {fmt(planned)}
          {over && <span className={`ml-1 ${isIncome ? 'text-green-500' : 'text-red-400'}`}>({fmt(diff)} over)</span>}
        </span>
        <span className={over ? (isIncome ? 'text-green-500' : 'text-red-400') : ''}>{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category selector — for lines with multiple linked categories.
// Shows "N categories ▾" button that opens a list where each category
// can be independently toggled to show/hide its transaction panel.
// ---------------------------------------------------------------------------

function CategorySelector({ categories, open, onToggle }: {
  categories: string[]
  open: Set<string>
  onToggle: (cat: string) => void
}) {
  const [showList, setShowList] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowList(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleToggle() {
    if (!showList && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setDropUp(window.innerHeight - rect.bottom < 220)
    }
    setShowList((v) => !v)
  }

  const anyOpen = categories.some((c) => open.has(c))

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleToggle}
        className={`text-xs border rounded-full px-2 py-0.5 transition-colors whitespace-nowrap ${
          anyOpen
            ? 'bg-blue-50 border-blue-300 text-blue-600'
            : 'text-gray-500 border-gray-200 hover:border-gray-400'
        }`}
      >
        {categories.length} categories {showList ? '▴' : '▾'}
      </button>
      {showList && (
        <div className={`absolute left-0 ${dropUp ? 'bottom-7' : 'top-7'} z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-max min-w-[10rem]`}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onToggle(cat)}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 capitalize flex items-center gap-2 whitespace-nowrap"
            >
              <span className={`w-3 h-3 rounded-full border transition-colors ${
                open.has(cat) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
              }`} />
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Transaction panel — expands below a line row to show paginated transactions
// for a single linked category within the budget's date range.
// ---------------------------------------------------------------------------

const TXNS_PAGE_SIZE = 10

function CategoryTransactionsPanel({ category, startDate, endDate, isIncome }: {
  category: string
  startDate: string
  endDate: string
  isIncome: boolean
}) {
  const [page, setPage] = useState(0)
  const { data: allTxns = [], isLoading } = useTransactions({
    category,
    start_date: startDate,
    end_date: endDate,
    limit: 500,
  })

  const pageCount = Math.ceil(allTxns.length / TXNS_PAGE_SIZE)
  const txns = allTxns.slice(page * TXNS_PAGE_SIZE, (page + 1) * TXNS_PAGE_SIZE)

  return (
    <div className="border-t border-gray-100 bg-gray-50/60">
      <div className="px-4 py-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
          {category}
        </span>
        {!isLoading && (
          <span className="text-[10px] text-gray-400">
            {allTxns.length} transaction{allTxns.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="px-4 pb-3 text-xs text-gray-400">Loading…</p>
      ) : allTxns.length === 0 ? (
        <p className="px-4 pb-3 text-xs text-gray-400">No transactions in this period.</p>
      ) : (
        <>
          <div className="divide-y divide-gray-100">
            {txns.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">
                    {t.merchant_name ?? t.category ?? '—'}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {t.date}{t.account_name ? ` · ${t.account_name}` : ''}
                  </p>
                </div>
                <span className={`text-xs font-semibold tabular-nums shrink-0 ${isIncome ? 'text-green-600' : 'text-gray-700'}`}>
                  {fmt(Math.abs(t.amount))}
                </span>
              </div>
            ))}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-[10px] text-blue-500 disabled:text-gray-300 hover:text-blue-600"
              >
                ← Prev
              </button>
              <span className="text-[10px] text-gray-400">{page + 1} / {pageCount}</span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page === pageCount - 1}
                className="text-[10px] text-blue-500 disabled:text-gray-300 hover:text-blue-600"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
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
// and expandable per-category transaction panels.
// ---------------------------------------------------------------------------

function LineRow({ line, allCategories, startDate, endDate, onSave, onDelete,
  isDragOver, onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  line: BudgetLine
  allCategories: string[]
  startDate: string
  endDate: string
  onSave: (data: { name: string; planned_amount: number; categories: string[] }) => Promise<void>
  onDelete: () => void
  isDragOver?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
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

  // Which category transaction panels are currently expanded
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set())
  // Whether the category edit dropdown is open
  const [editingCategories, setEditingCategories] = useState(false)
  const [editCatDropUp, setEditCatDropUp] = useState(false)
  const editCatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editingCategories) return
    function handleOutsideClick(e: MouseEvent) {
      if (editCatRef.current && !editCatRef.current.contains(e.target as Node)) {
        setEditingCategories(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [editingCategories])

  useEffect(() => {
    if (!editingName) { setDisplayName(line.name); setNameVal(line.name) }
  }, [line.name, editingName])

  useEffect(() => {
    if (!editingAmount) {
      setDisplayAmount(line.planned_amount)
      setAmountVal(String(line.planned_amount))
    }
  }, [line.planned_amount, editingAmount])

  useEffect(() => { setDisplayCategories(line.categories) }, [line.categories])

  useEffect(() => { if (editingName) nameInputRef.current?.select() }, [editingName])
  useEffect(() => { if (editingAmount) amountInputRef.current?.select() }, [editingAmount])

  function toggleCategoryPanel(cat: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

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

  async function handleCategoryToggle(cat: string) {
    const catLower = cat.toLowerCase()
    const current = displayCategories.map((c) => c.toLowerCase())
    const removing = current.includes(catLower)
    const newCats = removing
      ? displayCategories.filter((c) => c.toLowerCase() !== catLower)
      : [...displayCategories, catLower]
    setDisplayCategories(newCats)
    if (removing) {
      setOpenCategories((prev) => {
        const next = new Set(prev)
        next.delete(catLower)
        return next
      })
    }
    try {
      await onSave({ name: displayName, planned_amount: displayAmount, categories: newCats })
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
    <div
      className={`border-b border-gray-100 last:border-0 group transition-colors ${isDragOver ? 'bg-blue-50' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center">
        {/* Drag handle */}
        <div className="pl-3 pr-1 text-gray-300 cursor-grab active:cursor-grabbing select-none opacity-0 group-hover:opacity-100 transition-opacity text-base">
          ⠿
        </div>
        {/* Name — click to edit */}
        <div className="flex-1 flex items-center px-2 py-3.5 gap-2 min-w-0">
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

          {/* Category viewer: single chip or multi-category selector */}
          {!editingName && displayCategories.length === 1 && (
            <button
              type="button"
              onClick={() => toggleCategoryPanel(displayCategories[0])}
              className={`text-xs border rounded-full px-2 py-0.5 transition-colors whitespace-nowrap capitalize ${
                openCategories.has(displayCategories[0])
                  ? 'bg-blue-50 border-blue-300 text-blue-600'
                  : 'text-gray-500 border-gray-200 hover:border-gray-400'
              }`}
            >
              {displayCategories[0]} {openCategories.has(displayCategories[0]) ? '▴' : '▾'}
            </button>
          )}
          {!editingName && displayCategories.length > 1 && (
            <CategorySelector
              categories={displayCategories}
              open={openCategories}
              onToggle={toggleCategoryPanel}
            />
          )}

          {/* Edit categories button + dropdown.
              When no categories are linked, show a visible "link categories" pill.
              When categories are already linked, show a subtle pencil icon. */}
          {!editingName && (
            <div className="relative" ref={editCatRef}>
              <button
                type="button"
                onClick={() => {
                  if (!editingCategories && editCatRef.current) {
                    const rect = editCatRef.current.getBoundingClientRect()
                    setEditCatDropUp(window.innerHeight - rect.bottom < 220)
                  }
                  setEditingCategories((v) => !v)
                }}
                className={
                  displayCategories.length === 0
                    ? 'text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5 hover:border-gray-300 hover:text-gray-500 transition-colors'
                    : 'text-gray-400 hover:text-gray-600 transition-colors text-xs leading-none px-0.5 opacity-0 group-hover:opacity-100'
                }
                title="Edit categories"
              >
                {displayCategories.length === 0 ? 'link categories' : '✎'}
              </button>
              {editingCategories && (
                <div className={`absolute left-0 ${editCatDropUp ? 'bottom-6' : 'top-6'} z-30 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-max min-w-[12rem] max-h-52 overflow-y-auto`}>
                  {allCategories.length === 0 && (
                    <p className="text-xs text-gray-400 px-3 py-2">No categories found</p>
                  )}
                  {allCategories.map((c) => {
                    const selected = displayCategories.map((x) => x.toLowerCase()).includes(c.toLowerCase())
                    return (
                      <button
                        key={c}
                        onClick={() => handleCategoryToggle(c)}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 capitalize flex items-center gap-2 whitespace-nowrap"
                      >
                        <span className={`w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center text-[10px] ${
                          selected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'
                        }`}>
                          {selected && '✓'}
                        </span>
                        {c}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
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

      {/* Transaction panels — one per open category, can be open simultaneously */}
      {Array.from(openCategories).map((cat) => (
        <CategoryTransactionsPanel
          key={cat}
          category={cat}
          startDate={startDate}
          endDate={endDate}
          isIncome={isIncome}
        />
      ))}
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
  const reorderMut = useReorderBudgetLines(id)

  const [adding, setAdding] = useState<'income' | 'expense' | null>(null)
  const linesKey = [...queryKeys.budgets, id, 'lines']

  // Local display order — updated instantly on drag for visual feedback
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Refs to track drag state without causing extra re-renders
  const dragSrcId = useRef<string | null>(null)
  const preDragIds = useRef<string[]>([])
  const lastDragOverId = useRef<string | null>(null)
  const dropCommitted = useRef(false)

  // Sync local order from server whenever data changes (but not mid-drag)
  useEffect(() => {
    if (!dragSrcId.current) {
      setOrderedIds(lines.map((l) => l.id))
    }
  }, [lines])

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

  const period = getBudgetPeriod(budget)

  // Build display order from orderedIds, falling back to server order for new items
  const orderedLines = [
    ...orderedIds.map((oid) => lines.find((l) => l.id === oid)).filter((l): l is BudgetLine => l != null),
    ...lines.filter((l) => !orderedIds.includes(l.id)), // newly added lines not yet in orderedIds
  ]
  const incomeLines = orderedLines.filter((l) => l.line_type === 'income')
  const expenseLines = orderedLines.filter((l) => l.line_type === 'expense')

  const totalIncome = incomeLines.reduce((s, l) => s + l.planned_amount, 0)
  const totalExpenses = expenseLines.reduce((s, l) => s + l.planned_amount, 0)
  const balance = totalIncome - totalExpenses

  // ---------------------------------------------------------------------------
  // Drag handlers
  // ---------------------------------------------------------------------------

  function handleDragStart(lineId: string, currentIds: string[]) {
    dragSrcId.current = lineId
    preDragIds.current = currentIds
    dropCommitted.current = false
  }

  function handleDragOver(e: React.DragEvent, hoverId: string, section: 'income' | 'expense') {
    e.preventDefault()
    const srcId = dragSrcId.current
    if (!srcId || srcId === hoverId) return
    if (lastDragOverId.current === hoverId) return // already handled this target

    // Check that src and target are in the same section (no cross-section dragging)
    const srcLine = lines.find((l) => l.id === srcId)
    if (!srcLine || srcLine.line_type !== section) return

    lastDragOverId.current = hoverId
    setDragOverId(hoverId)

    setOrderedIds((prev) => {
      const ids = [...prev]
      const fromIdx = ids.indexOf(srcId)
      const toIdx = ids.indexOf(hoverId)
      if (fromIdx === -1 || toIdx === -1) return prev
      ids.splice(fromIdx, 1)
      ids.splice(toIdx, 0, srcId)
      return ids
    })
  }

  function handleDrop(section: 'income' | 'expense') {
    dropCommitted.current = true
    // NOTE: dragSrcId.current is intentionally NOT cleared here.
    // It must stay set until handleDragEnd so the useEffect cannot fire between
    // the drop and dragend events and reset orderedIds back to server order.
    lastDragOverId.current = null
    setDragOverId(null)

    // Persist the new order to the server
    const sectionLines = orderedLines.filter((l) => l.line_type === section)
    reorderMut.mutate(sectionLines.map((l, i) => ({ id: l.id, sort_order: i + 1 })))

    // Update the query cache so the new order survives navigation / other refetches
    qc.setQueryData<BudgetLine[]>(linesKey, (old) => {
      if (!old) return old
      return orderedIds.map((oid) => old.find((l) => l.id === oid)).filter((l): l is BudgetLine => l != null)
    })
  }

  function handleDragEnd() {
    if (!dropCommitted.current) {
      // Dropped outside a valid target — reset to pre-drag order
      setOrderedIds(preDragIds.current)
    }
    // Clear dragSrcId here (after drop) so the useEffect is free to sync again
    dragSrcId.current = null
    lastDragOverId.current = null
    dropCommitted.current = false
    setDragOverId(null)
  }

  // ---------------------------------------------------------------------------
  // CRUD handlers
  // ---------------------------------------------------------------------------

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
      sort_order: null,
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

  const incomeSectionIds = incomeLines.map((l) => l.id)
  const expenseSectionIds = expenseLines.map((l) => l.id)

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
      <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-visible mb-4">
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
                startDate={period.start}
                endDate={period.end}
                onSave={(data) => handleEdit(line, data)}
                onDelete={() => handleDelete(line)}
                isDragOver={dragOverId === line.id}
                onDragStart={() => handleDragStart(line.id, [...incomeSectionIds, ...expenseSectionIds])}
                onDragOver={(e) => handleDragOver(e, line.id, 'income')}
                onDrop={() => handleDrop('income')}
                onDragEnd={handleDragEnd}
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
                startDate={period.start}
                endDate={period.end}
                onSave={(data) => handleEdit(line, data)}
                onDelete={() => handleDelete(line)}
                isDragOver={dragOverId === line.id}
                onDragStart={() => handleDragStart(line.id, [...incomeSectionIds, ...expenseSectionIds])}
                onDragOver={(e) => handleDragOver(e, line.id, 'expense')}
                onDrop={() => handleDrop('expense')}
                onDragEnd={handleDragEnd}
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
