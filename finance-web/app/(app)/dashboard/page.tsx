'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAccounts, useLiabilities, useTransactions, useSyncTransactions, useCategories } from '@/hooks/queries'
import type { Transaction } from '@/lib/api'
import SpendingChart from '@/components/SpendingChart'
import TransactionTable from '@/components/TransactionTable'
import RecategorizeModal from '@/components/RecategorizeModal'

type DateTab = 'this_month' | 'this_week' | 'last_month' | 'custom'

// Plaid account types that represent money owed, not money held.
// Their current_balance is the outstanding debt amount.
const DEBT_ACCOUNT_TYPES = new Set(['credit', 'loan'])

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

function thisMonthRange() {
  const now = new Date()
  return {
    start: toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

function thisWeekRange() {
  const now = new Date()
  // Week starts Monday
  const day = now.getDay() // 0=Sun, 1=Mon, ...
  const diffToMon = (day === 0 ? -6 : 1 - day)
  const mon = new Date(now)
  mon.setDate(now.getDate() + diffToMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { start: toDateStr(mon), end: toDateStr(sun) }
}

function lastMonthRange() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const last = new Date(now.getFullYear(), now.getMonth(), 0)
  return { start: toDateStr(first), end: toDateStr(last) }
}

function getDateRange(tab: DateTab, customStart: string, customEnd: string) {
  if (tab === 'this_week') return thisWeekRange()
  if (tab === 'last_month') return lastMonthRange()
  if (tab === 'custom') return { start: customStart, end: customEnd }
  return thisMonthRange()
}

// Plaid primary categories that are never real spending.
const EXCLUDED_CATEGORIES = new Set(['TRANSFER_OUT', 'TRANSFER_IN'])

// Groups transactions (debits only) by category and returns sorted totals.
// Detects internal transfers (e.g. checking → savings) by matching debit/credit
// pairs across accounts, so they don't inflate the spending chart.
function groupByCategory(txns: Transaction[], depositoryAccountNames: Set<string>) {
  // Index credits by "date|amount" → set of receiving account names.
  // Used to detect the other leg of an internal transfer.
  const creditsBySignature = new Map<string, Set<string>>()
  for (const t of txns) {
    if (t.amount < 0 && t.account_name) {
      const sig = `${t.date}|${Math.abs(t.amount).toFixed(2)}`
      if (!creditsBySignature.has(sig)) creditsBySignature.set(sig, new Set())
      creditsBySignature.get(sig)!.add(t.account_name)
    }
  }

  const map: Record<string, number> = {}
  for (const t of txns) {
    if (t.amount <= 0) continue // Skip credits / income
    const cat = t.category ?? 'Uncategorized'
    if (EXCLUDED_CATEGORIES.has(cat)) continue

    // Check if this debit has a matching credit landing in a depository account
    // on the same date. If so it's an internal transfer (e.g. checking → savings),
    // not real spending. Credit card payments are kept because the receiving
    // account is type "credit", not depository.
    const sig = `${t.date}|${t.amount.toFixed(2)}`
    const creditAccounts = creditsBySignature.get(sig)
    if (creditAccounts) {
      const goesToDepository = Array.from(creditAccounts).some((name) => depositoryAccountNames.has(name))
      if (goesToDepository) continue
    }

    map[cat] = (map[cat] ?? 0) + t.amount
  }
  return Object.entries(map)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DashboardPage() {
  const [dateTab, setDateTab] = useState<DateTab>('this_month')
  const [customStart, setCustomStart] = useState(() => thisMonthRange().start)
  const [customEnd, setCustomEnd] = useState(() => thisMonthRange().end)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<Transaction | null>(null)

  const { start, end } = getDateRange(dateTab, customStart, customEnd)

  const totalLabel =
    dateTab === 'this_month' ? 'Total spent this month'
    : dateTab === 'this_week' ? 'Total spent this week'
    : dateTab === 'last_month' ? 'Total spent last month'
    : `Total spent ${start} – ${end}`

  const { data: accounts = [], isLoading: loadingAccounts, error: accountsError } = useAccounts()
  const { data: liabilities = [], isLoading: loadingLiabs } = useLiabilities()
  const { data: categories = [] } = useCategories()
  const syncMutation = useSyncTransactions()
  const { data: transactions = [], isLoading: loadingTxns } = useTransactions({
    start_date: start,
    end_date: end,
    limit: 500,
  })

  const loading = loadingAccounts || loadingLiabs
  const error = accountsError
  const colorMap = Object.fromEntries(
    categories.filter((c) => c.color).map((c) => [c.name, c.color!]),
  )

  // Split Plaid accounts into asset accounts (depository, investment, etc.)
  // vs debt accounts (credit cards, loans). Debt accounts' current_balance
  // represents the amount owed, so they count against net worth.
  const assetAccounts = accounts.filter((a) => !DEBT_ACCOUNT_TYPES.has(a.account_type))
  const debtAccounts = accounts.filter((a) => DEBT_ACCOUNT_TYPES.has(a.account_type))

  const totalAssets = assetAccounts.reduce((s, a) => s + (a.current_balance ?? 0), 0)
  // Total debt = Plaid credit/loan balances + manually-entered liabilities
  const totalDebt =
    debtAccounts.reduce((s, a) => s + (a.current_balance ?? 0), 0) +
    liabilities.reduce((s, l) => s + l.balance, 0)
  const netWorth = totalAssets - totalDebt

  // Names of depository accounts (checking, savings, etc.) — used to detect
  // internal transfers that shouldn't count as spending.
  const depositoryAccountNames = new Set(assetAccounts.map((a) => a.account_name))
  const spendingData = groupByCategory(transactions, depositoryAccountNames)

  if (loading) {
    return <p className="text-cream-muted text-sm py-16 text-center">Loading dashboard…</p>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold text-cream">Dashboard</h1>

      {error && (
        <div className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error instanceof Error ? error.message : 'Failed to load data'}
        </div>
      )}

      {/* Net Worth Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Net Worth"
          value={netWorth}
          color={netWorth >= 0 ? 'text-accent' : 'text-danger'}
        />
        <StatCard label="Total Assets" value={totalAssets} color="text-accent" />
        <StatCard label="Total Debt" value={totalDebt} color="text-warning-display" />
      </div>

      {/* Connected Accounts */}
      {(accounts.length > 0 || liabilities.length > 0) && (
        <section className="app-panel rounded-3xl p-6">
          <h2 className="text-base font-semibold text-cream mb-4">Accounts</h2>

          {assetAccounts.length > 0 && (
            <>
              <p className="text-xs font-medium text-cream-muted uppercase tracking-wide mb-2">Assets</p>
              <ul className="divide-y divide-surface-border mb-4">
                {assetAccounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-cream">{a.account_name}</p>
                      <p className="text-xs text-cream-muted capitalize">
                        {a.institution_name ?? ''} · {a.account_type}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-accent-text dark:text-accent">${fmt(a.current_balance ?? 0)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          {(debtAccounts.length > 0 || liabilities.length > 0) && (
            <>
              <p className="text-xs font-medium text-cream-muted uppercase tracking-wide mb-2">Debt</p>
              <ul className="divide-y divide-surface-border">
                {debtAccounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-cream">{a.account_name}</p>
                      <p className="text-xs text-cream-muted capitalize">
                        {a.institution_name ?? ''} · {a.account_type}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-warning">${fmt(a.current_balance ?? 0)}</p>
                  </li>
                ))}
                {liabilities.map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-cream">{l.name}</p>
                      <p className="text-xs text-cream-muted capitalize">
                        Manual · {l.type ? l.type.replace(/_/g, ' ') : 'debt'}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-warning">${fmt(l.balance)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* Spending Chart */}
      <section className="app-panel rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-cream">Spending</h2>
          {/* Date range tabs */}
          <div className="flex items-center gap-1 rounded-2xl border border-surface-border bg-surface/85 p-1 text-sm">
            {([
              ['this_month', 'This Month'],
              ['this_week', 'This Week'],
              ['last_month', 'Last Month'],
              ['custom', 'Custom'],
            ] as [DateTab, string][]).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => { setDateTab(tab); setSelectedCategory(null) }}
                className={`px-3 py-1 rounded-md transition-colors ${
                  dateTab === tab
                    ? 'bg-surface-raised text-cream shadow-sm font-medium'
                    : 'text-cream-muted hover:text-cream'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date pickers */}
        {dateTab === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="flex items-center gap-2 text-sm text-cream-muted">
              From
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className="border border-surface-border bg-surface rounded-md px-2 py-1 text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-cream-muted">
              To
              <input
                type="date"
                value={customEnd}
                min={customStart}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="border border-surface-border bg-surface rounded-md px-2 py-1 text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
          </div>
        )}

        {loadingTxns ? (
          <p className="text-sm text-cream-muted text-center py-8">Loading…</p>
        ) : spendingData.length > 0 ? (
          <SpendingChart
            data={spendingData}
            selectedCategory={selectedCategory}
            onCategoryClick={(cat) =>
              setSelectedCategory((prev) => (prev === cat ? null : cat))
            }
            totalLabel={totalLabel}
          />
        ) : accounts.length > 0 ? (
          <p className="text-sm text-cream-muted text-center py-8">
            No spending data for this period.{' '}
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="text-accent-text dark:text-accent hover:underline disabled:opacity-50"
            >
              {syncMutation.isPending ? 'Syncing…' : 'Resync'}
            </button>
            {' '}or{' '}
            <Link href="/settings" className="text-accent-text dark:text-accent hover:underline">
              connect another account
            </Link>
            .
          </p>
        ) : (
          <p className="text-sm text-cream-muted text-center py-8">
            No spending data for this period.{' '}
            <Link href="/settings" className="text-accent-text dark:text-accent hover:underline">
              Connect a bank account
            </Link>{' '}
            to get started.
          </p>
        )}
      </section>

      {/* Recent Transactions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-cream">Recent Transactions</h2>
            {selectedCategory && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent-text dark:text-accent">
                {selectedCategory}
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="ml-0.5 hover:text-accent-text dark:hover:text-accent-hover"
                  aria-label="Clear filter"
                >
                  &times;
                </button>
              </span>
            )}
          </div>
          <Link href="/transactions" className="text-sm text-accent-text dark:text-accent hover:underline">
            View all
          </Link>
        </div>
        <TransactionTable
          transactions={selectedCategory
            ? transactions.filter((t) => (t.category ?? 'Uncategorized') === selectedCategory)
            : transactions.slice(0, 8)}
          colorMap={colorMap}
          onCategoryClick={setEditTarget}
        />
      </section>

      <RecategorizeModal
        key={editTarget?.id}
        transaction={editTarget}
        onClose={() => setEditTarget(null)}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="app-panel rounded-2xl p-5">
      <p className="text-xs text-cream-muted mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>
        {value < 0 ? '-' : ''}${fmt(Math.abs(value))}
      </p>
    </div>
  )
}
