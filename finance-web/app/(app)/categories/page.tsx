'use client'

import { useState } from 'react'
import type { Transaction } from '@/lib/api'
import { CATEGORY_PALETTE, getCategoryBadge, getSwatchColor, isHexColor } from '@/lib/categories'
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useTransactions,
  useCategoryHistory,
  useUndoCategoryChange,
  useClearCategoryHistory,
} from '@/hooks/queries'
import ColorPicker from '@/components/ColorPicker'
import RecategorizeModal from '@/components/RecategorizeModal'

// Special sentinel for "Uncategorized" in the sidebar
const UNCATEGORIZED = '__uncategorized__'

export default function CategoriesPage() {
  // ── Selection state ──────────────────────────────────────────────────────
  const [selected, setSelected] = useState<string | null>(null)

  // ── Create modal ─────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createColor, setCreateColor] = useState<string | null>(null)
  const [createError, setCreateError] = useState('')

  // ── Inline name editor (in the sidebar list) ─────────────────────────────
  const [editingName, setEditingName] = useState<string | null>(null)
  const [pendingName, setPendingName] = useState('')
  const [renameError, setRenameError] = useState('')

  // ── Inline color editor (in the sidebar list) ─────────────────────────────
  // Which category name is currently open for color editing
  const [editingColor, setEditingColor] = useState<string | null>(null)
  // The pending color selection (not yet saved)
  const [pendingColor, setPendingColor] = useState<string | null>(null)

  // ── Clear history confirmation ────────────────────────────────────────────
  const [confirmClear, setConfirmClear] = useState(false)

  // ── Recategorize modal ───────────────────────────────────────────────────
  const [target, setTarget] = useState<Transaction | null>(null)

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: categories = [], isLoading: catsLoading } = useCategories()
  const { data: history = [] } = useCategoryHistory()

  // Build a colorMap for badge rendering: name → color key
  const colorMap = Object.fromEntries(
    categories.filter((c) => c.color).map((c) => [c.name, c.color!]),
  )

  const txFilters =
    selected === UNCATEGORIZED
      ? { uncategorized: true, limit: 500 }
      : selected
      ? { category: selected, limit: 500 }
      : null

  const { data: transactions = [], isLoading: txLoading } = useTransactions(
    txFilters ?? {},
    { enabled: txFilters !== null },
  )

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createCat = useCreateCategory()
  const updateCat = useUpdateCategory()
  const deleteCat = useDeleteCategory()
  const undoChange = useUndoCategoryChange()
  const clearHistory = useClearCategoryHistory()

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    const name = createName.trim()
    if (!name) return
    createCat.mutate(
      { name, color: createColor ?? undefined },
      {
        onSuccess: () => {
          setCreateName('')
          setCreateColor(null)
          setShowCreate(false)
        },
        onError: (err) => setCreateError(err.message),
      },
    )
  }

  function openNameEditor(name: string) {
    setEditingName(name)
    setPendingName(name)
    setRenameError('')
    setEditingColor(null)
  }

  function saveRename(currentColor: string | null) {
    if (!editingName) return
    const trimmed = pendingName.trim()
    if (!trimmed) { setRenameError('Name cannot be empty.'); return }
    if (trimmed === editingName) { setEditingName(null); return }
    setRenameError('')
    updateCat.mutate(
      { name: editingName, color: currentColor, newName: trimmed },
      {
        onSuccess: () => {
          if (selected === editingName) setSelected(trimmed)
          setEditingName(null)
        },
        onError: (err) => setRenameError(err.message),
      },
    )
  }

  function openColorEditor(name: string, currentColor: string | null) {
    setEditingColor(name)
    setPendingColor(currentColor)
    setEditingName(null)
  }

  function saveColor() {
    if (!editingColor) return
    updateCat.mutate(
      { name: editingColor, color: pendingColor },
      { onSuccess: () => setEditingColor(null) },
    )
  }

  const selectedLabel = selected === UNCATEGORIZED ? 'Uncategorized' : selected ?? ''

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-cream">Categories</h1>
        <button
          onClick={() => { setShowCreate(true); setCreateName(''); setCreateColor(null); setCreateError('') }}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
        >
          + New Category
        </button>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">

        {/* ── Left: category list ─────────────────────────────────────────── */}
        <div className="app-panel rounded-2xl p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-cream-muted">
            All Categories
          </p>

          {catsLoading ? (
            <p className="text-sm text-cream-muted">Loading…</p>
          ) : (
            <ul className="space-y-1">
              {categories.map((cat) => (
                <li key={cat.name}>
                  {/* Main row */}
                  <div
                    className={`group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-colors ${
                      selected === cat.name
                        ? 'bg-accent/15 text-cream'
                        : 'text-cream-muted hover:bg-surface-hover hover:text-cream'
                    }`}
                    onClick={() => {
                      if (editingName !== cat.name) {
                        setSelected(selected === cat.name ? null : cat.name)
                      }
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      {/* Color swatch dot */}
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-white/10"
                        style={{ backgroundColor: getSwatchColor(cat.color, cat.name) }}
                      />
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="rounded-full bg-surface-raised px-1.5 py-0.5 text-xs text-cream-muted">
                        {cat.transaction_count}
                      </span>
                      {/* Rename button (visible on hover) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openNameEditor(cat.name)
                        }}
                        className="hidden rounded px-1 py-0.5 text-xs text-cream-muted/60 transition-colors hover:bg-accent/10 hover:text-accent group-hover:block"
                        title="Rename"
                      >
                        ✎
                      </button>
                      {/* Edit color button (visible on hover) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openColorEditor(cat.name, cat.color ?? null)
                        }}
                        className="hidden rounded px-1 py-0.5 text-xs text-cream-muted/60 transition-colors hover:bg-accent/10 hover:text-accent group-hover:block"
                        title="Change color"
                      >
                        ◑
                      </button>
                      {/* Delete button — only for empty custom categories */}
                      {cat.transaction_count === 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteCat.mutate(cat.name)
                          }}
                          disabled={deleteCat.isPending}
                          className="hidden rounded px-1 py-0.5 text-xs text-cream-muted/50 transition-colors hover:bg-danger/10 hover:text-danger group-hover:block disabled:opacity-50"
                          title="Delete empty category"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline name editor (expands below the row) */}
                  {editingName === cat.name && (
                    <div
                      className="mt-1 rounded-xl border border-surface-border bg-surface-raised p-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="mb-2 text-xs font-medium text-cream-muted">Rename category</p>
                      <input
                        type="text"
                        value={pendingName}
                        onChange={(e) => setPendingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); saveRename(cat.color ?? null) }
                          if (e.key === 'Escape') setEditingName(null)
                        }}
                        autoFocus
                        className="mb-2 w-full rounded-lg border border-surface-border bg-surface px-2 py-1.5 text-sm text-cream placeholder:text-cream-muted/50 focus:border-accent focus:outline-none"
                      />
                      {renameError && (
                        <p className="mb-2 text-xs text-danger">{renameError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingName(null)}
                          className="flex-1 rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-cream-muted transition-colors hover:bg-surface-hover"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveRename(cat.color ?? null)}
                          disabled={updateCat.isPending || !pendingName.trim()}
                          className="flex-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
                        >
                          {updateCat.isPending ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline color editor (expands below the row) */}
                  {editingColor === cat.name && (
                    <div
                      className="mt-1 rounded-xl border border-surface-border bg-surface-raised p-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="mb-2 text-xs font-medium text-cream-muted">Pick a color</p>
                      <ColorPicker value={pendingColor} onChange={setPendingColor} />
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => setEditingColor(null)}
                          className="flex-1 rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-cream-muted transition-colors hover:bg-surface-hover"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveColor}
                          disabled={updateCat.isPending}
                          className="flex-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
                        >
                          {updateCat.isPending ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}

              {/* Uncategorized entry */}
              <li>
                <div
                  className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-colors ${
                    selected === UNCATEGORIZED
                      ? 'bg-accent/15 text-cream'
                      : 'text-cream-muted hover:bg-surface-hover hover:text-cream'
                  }`}
                  onClick={() => setSelected(selected === UNCATEGORIZED ? null : UNCATEGORIZED)}
                >
                  <span className="flex items-center gap-2 text-sm font-medium italic">
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-surface-border bg-surface-raised" />
                    Uncategorized
                  </span>
                </div>
              </li>
            </ul>
          )}
        </div>

        {/* ── Right: transaction panel ──────────────────────────────────────── */}
        <div className="app-panel rounded-2xl">
          {selected === null ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-sm text-cream-muted">
                Select a category on the left to view its transactions.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
                <h2 className="font-semibold text-cream">
                  {selectedLabel}
                  {!txLoading && (
                    <span className="ml-2 text-sm font-normal text-cream-muted">
                      ({transactions.length} transaction{transactions.length !== 1 ? 's' : ''})
                    </span>
                  )}
                </h2>
              </div>

              {txLoading ? (
                <p className="px-5 py-8 text-sm text-cream-muted">Loading…</p>
              ) : transactions.length === 0 ? (
                <p className="px-5 py-8 text-sm text-cream-muted">No transactions found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-surface-border bg-surface/80">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-cream-muted">Date</th>
                        <th className="px-4 py-3 text-left font-medium text-cream-muted">Merchant</th>
                        <th className="px-4 py-3 text-left font-medium text-cream-muted">Category</th>
                        <th className="px-4 py-3 text-right font-medium text-cream-muted">Amount</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className="border-b border-surface-border last:border-0 hover:bg-surface-hover"
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-cream-muted">
                            {new Date(tx.date + 'T00:00:00').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-4 py-3 text-cream">
                            <span className="font-medium">{tx.merchant_name ?? '—'}</span>
                            {tx.is_recurring && (
                              <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent-text dark:text-accent">
                                recurring
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {tx.category ? (
                              (() => {
                                const { className, style } = getCategoryBadge(tx.category, colorMap)
                                return (
                                  <span
                                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
                                    style={style}
                                  >
                                    {tx.category}
                                  </span>
                                )
                              })()
                            ) : (
                              <span className="text-xs italic text-cream-muted">uncategorized</span>
                            )}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-medium tabular-nums ${
                              tx.amount < 0 ? 'text-accent-text dark:text-accent' : 'text-warning'
                            }`}
                          >
                            {tx.amount < 0 ? '+' : ''}$
                            {Math.abs(tx.amount).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setTarget(tx)}
                              className="rounded-lg px-2 py-1 text-xs text-cream-muted transition-colors hover:bg-accent/10 hover:text-accent"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Undo history ──────────────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="app-panel rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-cream-muted">
              Recent Changes
            </p>
            <button
              onClick={() => setConfirmClear(true)}
              className="text-xs text-cream-muted transition-colors hover:text-danger"
            >
              Clear All
            </button>
          </div>
          <ul className="space-y-2">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-4 rounded-xl bg-surface-raised px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-cream">{entry.description}</p>
                  <p className="text-xs text-cream-muted">
                    {new Date(entry.changed_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => undoChange.mutate(entry.id)}
                  disabled={undoChange.isPending}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-cream-muted transition-colors hover:bg-warning/10 hover:text-warning disabled:opacity-50"
                >
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Clear history confirmation ───────────────────────────────────── */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="app-panel w-full max-w-sm rounded-2xl p-6 shadow-app">
            <h2 className="mb-2 text-lg font-semibold text-cream">Clear Recent Changes?</h2>
            <p className="mb-5 text-sm text-cream-muted">
              This will remove all entries from the Recent Changes list. It will not affect your
              transactions — only the ability to undo these changes.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmClear(false)}
                className="flex-1 rounded-xl border border-surface-border px-4 py-2 text-sm font-medium text-cream-muted transition-colors hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearHistory.mutate(undefined, {
                    onSuccess: () => setConfirmClear(false),
                  })
                }}
                disabled={clearHistory.isPending}
                className="flex-1 rounded-xl bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger/80 disabled:opacity-50"
              >
                {clearHistory.isPending ? 'Clearing…' : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create category modal ─────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="app-panel w-full max-w-sm rounded-2xl p-6 shadow-app">
            <h2 className="mb-4 text-lg font-semibold text-cream">New Category</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-cream-muted">
                  Name
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Subscriptions"
                  autoFocus
                  className="w-full rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-sm text-cream placeholder:text-cream-muted/50 focus:border-accent focus:outline-none"
                />
                {createError && (
                  <p className="mt-1.5 text-xs text-danger">{createError}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-cream-muted">
                  Color
                  {createColor && (
                    <span
                      className="ml-2 text-xs font-normal"
                      style={{ color: getSwatchColor(createColor) }}
                    >
                      {isHexColor(createColor) ? createColor : CATEGORY_PALETTE[createColor]?.label}
                    </span>
                  )}
                </label>
                <ColorPicker value={createColor} onChange={setCreateColor} />
                {createColor && (
                  <div className="mt-2">
                    {(() => {
                      const previewName = createName || 'Preview'
                      const { className, style } = getCategoryBadge(previewName, { [previewName]: createColor })
                      return (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
                          style={style}
                        >
                          {previewName}
                        </span>
                      )
                    })()}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-xl border border-surface-border px-4 py-2 text-sm font-medium text-cream-muted transition-colors hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCat.isPending || !createName.trim()}
                  className="flex-1 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {createCat.isPending ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Recategorize modal ────────────────────────────────────────────── */}
      <RecategorizeModal
        key={target?.id}
        transaction={target}
        onClose={() => setTarget(null)}
        onSuccess={(newCategory) => {
          // If the selected category was renamed, follow it
          if (selected && selected !== UNCATEGORIZED && selected !== newCategory) {
            setSelected(newCategory)
          }
        }}
      />
    </div>
  )
}
