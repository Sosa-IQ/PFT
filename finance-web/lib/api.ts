// lib/api.ts — Typed wrappers for the FastAPI backend.
// Every function requires a Supabase JWT (access_token from the current session).

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// Generic fetch helper — adds auth header and throws a readable error on failure.
async function apiFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })

  // 204 No Content (e.g. DELETE) returns nothing.
  if (res.status === 204) return null as T

  const data = await res.json()
  if (!res.ok) throw new Error(data.detail ?? `API error ${res.status}`)
  return data
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Transaction {
  id: string
  date: string
  merchant_name: string | null
  category: string | null
  amount: number       // positive = debit (expense), negative = credit/income
  note: string | null
  is_recurring: boolean
  account_name: string | null
}

export interface Budget {
  category: string
  monthly_limit: number
}

export interface Goal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  deadline: string | null
}

export interface Liability {
  id: string
  name: string
  balance: number
  apr: number | null
  type: string | null
  minimum_payment: number | null
}

export interface SyncResult {
  added: number
  modified: number
  removed: number
}

// ── Transactions ───────────────────────────────────────────────────────────

export async function getTransactions(
  token: string,
  filters: { category?: string; start_date?: string; end_date?: string; limit?: number } = {},
): Promise<Transaction[]> {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', filters.category)
  if (filters.start_date) params.set('start_date', filters.start_date)
  if (filters.end_date) params.set('end_date', filters.end_date)
  if (filters.limit) params.set('limit', String(filters.limit))
  const qs = params.toString() ? `?${params}` : ''
  return apiFetch<Transaction[]>(`/transactions/${qs}`, token)
}

// ── Budgets ────────────────────────────────────────────────────────────────

export async function getBudgets(token: string): Promise<Budget[]> {
  return apiFetch<Budget[]>('/budgets/', token)
}

export async function createBudget(
  token: string,
  data: { category: string; monthly_limit: number },
): Promise<Budget> {
  return apiFetch<Budget>('/budgets/', token, { method: 'POST', body: JSON.stringify(data) })
}

export async function updateBudget(
  token: string,
  category: string,
  monthly_limit: number,
): Promise<Budget> {
  return apiFetch<Budget>(`/budgets/${encodeURIComponent(category)}`, token, {
    method: 'PUT',
    body: JSON.stringify({ monthly_limit }),
  })
}

export async function deleteBudget(token: string, category: string): Promise<void> {
  return apiFetch<void>(`/budgets/${encodeURIComponent(category)}`, token, { method: 'DELETE' })
}

// ── Goals ──────────────────────────────────────────────────────────────────

export async function getGoals(token: string): Promise<Goal[]> {
  return apiFetch<Goal[]>('/goals/', token)
}

export async function createGoal(
  token: string,
  data: { name: string; target_amount: number; current_amount?: number; deadline?: string },
): Promise<Goal> {
  return apiFetch<Goal>('/goals/', token, { method: 'POST', body: JSON.stringify(data) })
}

export async function updateGoal(
  token: string,
  goalId: string,
  data: { name?: string; target_amount?: number; current_amount?: number; deadline?: string },
): Promise<Goal> {
  return apiFetch<Goal>(`/goals/${goalId}`, token, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteGoal(token: string, goalId: string): Promise<void> {
  return apiFetch<void>(`/goals/${goalId}`, token, { method: 'DELETE' })
}

// ── Liabilities ────────────────────────────────────────────────────────────

export async function getLiabilities(token: string): Promise<Liability[]> {
  return apiFetch<Liability[]>('/liabilities/', token)
}

export async function createLiability(
  token: string,
  data: { name: string; balance: number; apr?: number; type?: string; minimum_payment?: number },
): Promise<Liability> {
  return apiFetch<Liability>('/liabilities/', token, { method: 'POST', body: JSON.stringify(data) })
}

export async function updateLiability(
  token: string,
  id: string,
  data: { name?: string; balance?: number; apr?: number; type?: string; minimum_payment?: number },
): Promise<Liability> {
  return apiFetch<Liability>(`/liabilities/${id}`, token, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteLiability(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/liabilities/${id}`, token, { method: 'DELETE' })
}

// ── Plaid ──────────────────────────────────────────────────────────────────

export async function getLinkToken(token: string): Promise<{ link_token: string }> {
  return apiFetch<{ link_token: string }>('/plaid/link-token', token, { method: 'POST' })
}

export async function exchangePlaidToken(
  token: string,
  publicToken: string,
): Promise<{ accounts_connected: number; transactions_synced: SyncResult }> {
  return apiFetch('/plaid/exchange-token', token, {
    method: 'POST',
    body: JSON.stringify({ public_token: publicToken }),
  })
}

export async function syncTransactions(token: string): Promise<SyncResult> {
  return apiFetch<SyncResult>('/plaid/sync', token, { method: 'POST' })
}
