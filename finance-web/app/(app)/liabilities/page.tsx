'use client'

import { useState } from 'react'
import {
  useDebtAccounts,
  useLiabilities,
  useCreateLiability,
  useUpdateLiability,
  useDeleteLiability,
  type Account,
} from '@/hooks/queries'
import type { Liability } from '@/lib/api'

// Estimate months to pay off a balance at APR with a given minimum payment.
function monthsToPayOff(balance: number, apr: number | null, minPayment: number | null): number | null {
  if (!balance || !minPayment || minPayment <= 0) return null
  if (!apr || apr === 0) return Math.ceil(balance / minPayment)
  const monthlyRate = apr / 100 / 12
  const ratio = (monthlyRate * balance) / minPayment
  if (ratio >= 1) return null // Payment doesn't cover interest
  return Math.ceil(-Math.log(1 - ratio) / Math.log(1 + monthlyRate))
}

function fmtPayoff(months: number | null): string {
  if (months == null) return '—'
  if (months <= 12) return `${months} mo`
  return `${Math.floor(months / 12)} yr ${months % 12} mo`
}

const LIABILITY_TYPES = ['credit_card', 'student_loan', 'mortgage', 'auto_loan', 'personal_loan', 'other']

export default function LiabilitiesPage() {
  const { data: plaidDebts = [], isLoading: loadingDebts } = useDebtAccounts()
  const { data: liabilities = [], isLoading: loadingLiabs, error: liabError } = useLiabilities()

  const createLiabilityMut = useCreateLiability()
  const updateLiabilityMut = useUpdateLiability()
  const deleteLiabilityMut = useDeleteLiability()

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formBalance, setFormBalance] = useState('')
  const [formApr, setFormApr] = useState('')
  const [formType, setFormType] = useState('')
  const [formMinPayment, setFormMinPayment] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function openAdd() {
    setEditingId(null)
    setFormName('')
    setFormBalance('')
    setFormApr('')
    setFormType('')
    setFormMinPayment('')
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(l: Liability) {
    setEditingId(l.id)
    setFormName(l.name)
    setFormBalance(String(l.balance))
    setFormApr(l.apr != null ? String(l.apr) : '')
    setFormType(l.type ?? '')
    setFormMinPayment(l.minimum_payment != null ? String(l.minimum_payment) : '')
    setFormError(null)
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const balance = parseFloat(formBalance)
    if (isNaN(balance) || balance < 0) {
      setFormError('Balance must be 0 or more.')
      return
    }
    const payload = {
      name: formName.trim(),
      balance,
      apr: formApr ? parseFloat(formApr) : undefined,
      type: formType || undefined,
      minimum_payment: formMinPayment ? parseFloat(formMinPayment) : undefined,
    }
    try {
      if (editingId) {
        await updateLiabilityMut.mutateAsync({ id: editingId, ...payload })
      } else {
        await createLiabilityMut.mutateAsync(payload)
      }
      setShowForm(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    try {
      await deleteLiabilityMut.mutateAsync(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const saving = createLiabilityMut.isPending || updateLiabilityMut.isPending
  const plaidTotal = plaidDebts.reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const manualTotal = liabilities.reduce((s, l) => s + l.balance, 0)
  const totalDebt = plaidTotal + manualTotal
  const loading = loadingDebts || loadingLiabs

  if (loading) return <p className="text-gray-400 text-sm py-16 text-center">Loading…</p>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Liabilities</h1>
          {totalDebt > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              Total debt:{' '}
              <span className="font-semibold text-red-500">
                ${totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </p>
          )}
        </div>
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Add Manual Debt
        </button>
      </div>

      {(liabError || error) && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {liabError instanceof Error ? liabError.message : error}
        </div>
      )}

      {/* ── Plaid-synced debt accounts ─────────────────────────────────────── */}
      {plaidDebts.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-700">From Bank (Plaid)</h2>
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">synced</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Account</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Balance</th>
                </tr>
              </thead>
              <tbody>
                {plaidDebts.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{a.account_name}</p>
                      {a.institution_name && (
                        <p className="text-xs text-gray-400">{a.institution_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{a.account_type}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-500">
                      ${(a.current_balance ?? 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-xs font-medium text-gray-500">Subtotal</td>
                  <td className="px-4 py-2 text-right text-sm font-semibold text-red-500">
                    ${plaidTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* ── Add / Edit Form ────────────────────────────────────────────────── */}
      {showForm && (
        <form
          onSubmit={handleSave}
          className="bg-white rounded-xl border border-gray-200 p-5 space-y-4"
        >
          <h2 className="font-semibold text-gray-800">
            {editingId ? 'Edit Liability' : 'Add Liability'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                placeholder="e.g. Student Loan"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Balance ($)</label>
              <input
                type="number"
                value={formBalance}
                onChange={(e) => setFormBalance(e.target.value)}
                required
                min="0"
                step="0.01"
                placeholder="2500.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                APR % <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="number"
                value={formApr}
                onChange={(e) => setFormApr(e.target.value)}
                min="0"
                max="100"
                step="0.01"
                placeholder="21.99"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum payment ($) <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="number"
                value={formMinPayment}
                onChange={(e) => setFormMinPayment(e.target.value)}
                min="0"
                step="0.01"
                placeholder="50.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <span className="text-gray-400">(optional)</span>
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select type…</option>
                {LIABILITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
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

      {/* ── Manually-tracked liabilities ──────────────────────────────────── */}
      <section>
        {liabilities.length > 0 && (
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Manual Entries</h2>
        )}
        {liabilities.length === 0 && plaidDebts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">
            No liabilities tracked. Connect a bank or add a manual debt above.
          </p>
        ) : liabilities.length === 0 ? null : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Balance</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">APR</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Min. Payment</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Payoff Est.</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {liabilities.map((l) => {
                  const months = monthsToPayOff(l.balance, l.apr, l.minimum_payment)
                  return (
                    <tr
                      key={l.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">{l.name}</td>
                      <td className="px-4 py-3 text-gray-500 capitalize">
                        {l.type ? l.type.replace(/_/g, ' ') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-red-500">
                        ${l.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {l.apr != null ? `${l.apr}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {l.minimum_payment != null ? `$${l.minimum_payment.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 text-xs">
                        {fmtPayoff(months)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3 justify-end">
                          <button
                            onClick={() => openEdit(l)}
                            className="text-xs text-blue-500 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(l.id, l.name)}
                            className="text-xs text-red-400 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
