'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  getTransactions,
  getLiabilities,
  type Transaction,
  type Liability,
} from '@/lib/api'
import SpendingChart from '@/components/SpendingChart'
import TransactionTable from '@/components/TransactionTable'

interface Account {
  id: string
  account_name: string
  account_type: string
  current_balance: number
  institution_name: string | null
}

// Plaid account types that represent money owed, not money held.
// Their current_balance is the outstanding debt amount.
const DEBT_ACCOUNT_TYPES = new Set(['credit', 'loan'])

// Returns "YYYY-MM-DD" strings for the first and last day of the current month.
function currentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

// Groups transactions (debits only) by category and returns sorted totals.
function groupByCategory(txns: Transaction[]) {
  const map: Record<string, number> = {}
  for (const t of txns) {
    if (t.amount <= 0) continue // Skip credits / income
    const cat = t.category ?? 'Uncategorized'
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
  const [accounts, setAccounts] = useState<Account[]>([])
  const [liabilities, setLiabilities] = useState<Liability[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const token = session.access_token
      const { start, end } = currentMonthRange()

      try {
        const [acctRes, libData, txnData] = await Promise.all([
          // Query accounts directly via Supabase (no accounts REST endpoint in API).
          supabase
            .from('accounts')
            .select('id, account_name, account_type, current_balance, institution_name')
            .order('current_balance', { ascending: false }),
          getLiabilities(token),
          getTransactions(token, { start_date: start, end_date: end, limit: 500 }),
        ])
        setAccounts(acctRes.data ?? [])
        setLiabilities(libData)
        setTransactions(txnData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    })
  }, [])

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
  const spendingData = groupByCategory(transactions)

  if (loading) {
    return <p className="text-gray-400 text-sm py-16 text-center">Loading dashboard…</p>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Net Worth Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Net Worth"
          value={netWorth}
          color={netWorth >= 0 ? 'text-green-600' : 'text-red-500'}
        />
        <StatCard label="Total Assets" value={totalAssets} color="text-blue-600" />
        <StatCard label="Total Debt" value={totalDebt} color="text-red-400" />
      </div>

      {/* Connected Accounts */}
      {(accounts.length > 0 || liabilities.length > 0) && (
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold mb-4">Accounts</h2>

          {assetAccounts.length > 0 && (
            <>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Assets</p>
              <ul className="divide-y divide-gray-100 mb-4">
                {assetAccounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{a.account_name}</p>
                      <p className="text-xs text-gray-400 capitalize">
                        {a.institution_name ?? ''} · {a.account_type}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-blue-600">${fmt(a.current_balance ?? 0)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          {(debtAccounts.length > 0 || liabilities.length > 0) && (
            <>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Debt</p>
              <ul className="divide-y divide-gray-100">
                {debtAccounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{a.account_name}</p>
                      <p className="text-xs text-gray-400 capitalize">
                        {a.institution_name ?? ''} · {a.account_type}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-red-500">${fmt(a.current_balance ?? 0)}</p>
                  </li>
                ))}
                {liabilities.map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{l.name}</p>
                      <p className="text-xs text-gray-400 capitalize">
                        Manual · {l.type ? l.type.replace(/_/g, ' ') : 'debt'}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-red-500">${fmt(l.balance)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* Spending Chart */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold mb-4">Spending This Month</h2>
        {spendingData.length > 0 ? (
          <SpendingChart data={spendingData} />
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">
            No spending data yet.{' '}
            <Link href="/settings" className="text-blue-500 hover:underline">
              Connect a bank account
            </Link>{' '}
            to get started.
          </p>
        )}
      </section>

      {/* Recent Transactions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Recent Transactions</h2>
          <Link href="/transactions" className="text-sm text-blue-500 hover:underline">
            View all
          </Link>
        </div>
        <TransactionTable transactions={transactions.slice(0, 8)} />
      </section>
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
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>
        {value < 0 ? '-' : ''}${fmt(Math.abs(value))}
      </p>
    </div>
  )
}
