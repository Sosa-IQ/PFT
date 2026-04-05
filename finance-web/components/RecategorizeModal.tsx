'use client'

import { useState } from 'react'
import type { Transaction } from '@/lib/api'
import { CATEGORY_PALETTE, getCategoryBadge, getSwatchColor, isHexColor } from '@/lib/categories'
import { useCategories, useRecategorizeTransaction, useUpdateCategory } from '@/hooks/queries'
import ColorPicker from './ColorPicker'

interface Props {
  transaction: Transaction | null
  onClose: () => void
  /** Called after a successful recategorize, with the new category name. */
  onSuccess?: (newCategory: string) => void
}

export default function RecategorizeModal({ transaction, onClose, onSuccess }: Props) {
  const [reMode, setReMode] = useState<'existing' | 'new'>('existing')
  const [newCat, setNewCat] = useState(transaction?.category ?? '')
  const [reNewColor, setReNewColor] = useState<string | null>(null)
  const [applyMerchant, setApplyMerchant] = useState(false)
  const [applyOldCat, setApplyOldCat] = useState(false)
  const [reError, setReError] = useState('')

  const { data: categories = [] } = useCategories()
  const recategorize = useRecategorizeTransaction()
  const updateCat = useUpdateCategory()

  const colorMap = Object.fromEntries(
    categories.filter((c) => c.color).map((c) => [c.name, c.color!]),
  )

  if (!transaction) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!transaction) return
    setReError('')
    const trimmed = newCat.trim()
    if (!trimmed) { setReError('Please select or enter a category.'); return }
    recategorize.mutate(
      {
        transactionId: transaction.id,
        new_category: trimmed,
        apply_to_same_merchant: applyMerchant,
        apply_to_old_category: applyOldCat,
      },
      {
        onSuccess: () => {
          if (reMode === 'new' && reNewColor) {
            updateCat.mutate({ name: trimmed, color: reNewColor })
          }
          onSuccess?.(trimmed)
          onClose()
        },
        onError: (err) => setReError(err.message),
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="app-panel w-full max-w-md rounded-2xl p-6 shadow-app">
        <h2 className="mb-0.5 text-lg font-semibold text-cream">Change Category</h2>
        <p className="mb-4 text-sm text-cream-muted">
          {transaction.merchant_name ?? 'Transaction'} ·{' '}
          {new Date(transaction.date + 'T00:00:00').toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mode tabs */}
          <div className="flex rounded-xl border border-surface-border p-0.5">
            <button
              type="button"
              onClick={() => { setReMode('existing'); setNewCat('') }}
              className={`flex-1 rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors ${
                reMode === 'existing'
                  ? 'bg-surface-raised text-cream shadow-sm'
                  : 'text-cream-muted hover:text-cream'
              }`}
            >
              Existing category
            </button>
            <button
              type="button"
              onClick={() => { setReMode('new'); setNewCat(''); setReNewColor(null) }}
              className={`flex-1 rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors ${
                reMode === 'new'
                  ? 'bg-surface-raised text-cream shadow-sm'
                  : 'text-cream-muted hover:text-cream'
              }`}
            >
              New category
            </button>
          </div>

          {/* Existing category: clickable badge grid */}
          {reMode === 'existing' && (
            <div>
              {categories.length === 0 ? (
                <p className="text-sm text-cream-muted">No categories yet.</p>
              ) : (
                <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto rounded-xl border border-surface-border p-3">
                  {categories.map((cat) => {
                    const { className, style } = getCategoryBadge(cat.name, colorMap)
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => setNewCat(cat.name)}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-all ${className} ${
                          newCat === cat.name
                            ? 'ring-2 ring-cream ring-offset-1 ring-offset-surface-raised'
                            : 'opacity-60 hover:opacity-100'
                        }`}
                        style={style}
                      >
                        {cat.name}
                      </button>
                    )
                  })}
                </div>
              )}
              {newCat && (
                <p className="mt-2 text-xs text-cream-muted">
                  Selected: <span className="font-medium text-cream">{newCat}</span>
                </p>
              )}
            </div>
          )}

          {/* New category: name + color picker */}
          {reMode === 'new' && (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-cream-muted">
                  Category name
                </label>
                <input
                  type="text"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  placeholder="e.g. Subscriptions"
                  autoFocus
                  className="w-full rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-sm text-cream placeholder:text-cream-muted/50 focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-cream-muted">
                  Color
                  {reNewColor && (
                    <span
                      className="ml-2 text-xs font-normal"
                      style={{ color: getSwatchColor(reNewColor) }}
                    >
                      {isHexColor(reNewColor) ? reNewColor : CATEGORY_PALETTE[reNewColor]?.label}
                    </span>
                  )}
                </label>
                <ColorPicker value={reNewColor} onChange={setReNewColor} />
                {newCat.trim() && (
                  <div className="mt-2">
                    {(() => {
                      const { className, style } = getCategoryBadge(
                        newCat.trim(),
                        reNewColor ? { [newCat.trim()]: reNewColor } : undefined,
                      )
                      return (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
                          style={style}
                        >
                          {newCat.trim()}
                        </span>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bulk-apply options */}
          <div className="space-y-2 rounded-xl border border-surface-border p-3">
            <p className="text-xs font-medium text-cream-muted">Also apply to…</p>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={applyMerchant}
                onChange={(e) => setApplyMerchant(e.target.checked)}
                disabled={!transaction.merchant_name}
                className="mt-0.5 accent-accent"
              />
              <span
                className={`text-sm ${transaction.merchant_name ? 'text-cream' : 'text-cream-muted/50'}`}
              >
                All past transactions from{' '}
                <strong>{transaction.merchant_name ?? '(no merchant)'}</strong>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={applyOldCat}
                onChange={(e) => setApplyOldCat(e.target.checked)}
                className="mt-0.5 accent-accent"
              />
              <span className="text-sm text-cream">
                All transactions currently tagged{' '}
                <strong>
                  {transaction.category ? `"${transaction.category}"` : '"uncategorized"'}
                </strong>
              </span>
            </label>
          </div>

          {reError && <p className="text-xs text-danger">{reError}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-surface-border px-4 py-2 text-sm font-medium text-cream-muted transition-colors hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={recategorize.isPending || !newCat.trim()}
              className="flex-1 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {recategorize.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
