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
  id: string
  name: string
  date_range_type: 'custom' | 'weekly' | 'biweekly' | 'monthly'
  start_date: string | null
  end_date: string | null
  created_at: string
  balance?: number
}

export interface BudgetLine {
  id: string
  budget_id: string
  line_type: 'income' | 'expense'
  name: string
  categories: string[]
  planned_amount: number
  sort_order: number | null
  computed_actual: number | null       // auto-calculated from transactions
  excluded_transaction_ids: string[]   // transactions excluded from tracking
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
  filters: {
    category?: string
    uncategorized?: boolean
    start_date?: string
    end_date?: string
    limit?: number
  } = {},
): Promise<Transaction[]> {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', filters.category)
  if (filters.uncategorized) params.set('uncategorized', 'true')
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
  data: {
    name: string
    date_range_type: 'custom' | 'weekly' | 'biweekly' | 'monthly'
    start_date?: string
    end_date?: string
  },
): Promise<Budget> {
  return apiFetch<Budget>('/budgets/', token, { method: 'POST', body: JSON.stringify(data) })
}

export async function updateBudget(
  token: string,
  id: string,
  data: { name?: string; date_range_type?: string; start_date?: string; end_date?: string },
): Promise<Budget> {
  return apiFetch<Budget>(`/budgets/${id}`, token, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteBudget(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/budgets/${id}`, token, { method: 'DELETE' })
}

// ── Budget Lines ────────────────────────────────────────────────────────────

export async function getBudgetLines(token: string, budgetId: string): Promise<BudgetLine[]> {
  return apiFetch<BudgetLine[]>(`/budgets/${budgetId}/lines`, token)
}

export async function createBudgetLine(
  token: string,
  budgetId: string,
  data: {
    line_type: 'income' | 'expense'
    name: string
    categories?: string[]
    planned_amount: number
  },
): Promise<BudgetLine> {
  return apiFetch<BudgetLine>(`/budgets/${budgetId}/lines`, token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateBudgetLine(
  token: string,
  budgetId: string,
  lineId: string,
  data: { name?: string; categories?: string[]; planned_amount?: number },
): Promise<BudgetLine> {
  return apiFetch<BudgetLine>(`/budgets/${budgetId}/lines/${lineId}`, token, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteBudgetLine(
  token: string,
  budgetId: string,
  lineId: string,
): Promise<void> {
  return apiFetch<void>(`/budgets/${budgetId}/lines/${lineId}`, token, { method: 'DELETE' })
}

export async function reorderBudgetLines(
  token: string,
  budgetId: string,
  items: { id: string; sort_order: number }[],
): Promise<void> {
  return apiFetch<void>(`/budgets/${budgetId}/lines/reorder`, token, {
    method: 'PATCH',
    body: JSON.stringify(items),
  })
}

export async function excludeTransaction(
  token: string,
  budgetId: string,
  lineId: string,
  transactionId: string,
): Promise<void> {
  await apiFetch<unknown>(`/budgets/${budgetId}/lines/${lineId}/excluded-transactions`, token, {
    method: 'POST',
    body: JSON.stringify({ transaction_id: transactionId }),
  })
}

export async function includeTransaction(
  token: string,
  budgetId: string,
  lineId: string,
  transactionId: string,
): Promise<void> {
  return apiFetch<void>(
    `/budgets/${budgetId}/lines/${lineId}/excluded-transactions/${transactionId}`,
    token,
    { method: 'DELETE' },
  )
}

// ── Transaction Categories ─────────────────────────────────────────────────

export async function getTransactionCategories(token: string): Promise<string[]> {
  return apiFetch<string[]>('/transactions/categories', token)
}

// ── Categories (full management) ───────────────────────────────────────────

export interface Category {
  name: string
  transaction_count: number
  is_custom: boolean
  color: string | null
}

export interface RecategorizeResult {
  log_id: string
  affected_count: number
  description: string
}

export interface CategoryChangeLog {
  id: string
  changed_at: string
  description: string
  affected_count: number
}

export async function getCategories(token: string): Promise<Category[]> {
  return apiFetch<Category[]>('/categories/', token)
}

export async function createCategory(
  token: string,
  name: string,
  color?: string,
): Promise<Category> {
  return apiFetch<Category>('/categories/', token, {
    method: 'POST',
    body: JSON.stringify({ name, color: color ?? null }),
  })
}

export async function updateCategory(
  token: string,
  name: string,
  color: string | null,
  newName?: string,
): Promise<Category> {
  return apiFetch<Category>(`/categories/${encodeURIComponent(name)}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ color, ...(newName ? { new_name: newName } : {}) }),
  })
}

export async function deleteCategory(token: string, name: string): Promise<void> {
  return apiFetch<void>(`/categories/${encodeURIComponent(name)}`, token, { method: 'DELETE' })
}

export async function recategorizeTransaction(
  token: string,
  transactionId: string,
  data: { new_category: string; apply_to_same_merchant?: boolean; apply_to_old_category?: boolean },
): Promise<RecategorizeResult> {
  return apiFetch<RecategorizeResult>(`/categories/transactions/${transactionId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function getCategoryHistory(token: string): Promise<CategoryChangeLog[]> {
  return apiFetch<CategoryChangeLog[]>('/categories/history', token)
}

export async function undoCategoryChange(token: string, logId: string): Promise<void> {
  await apiFetch<unknown>(`/categories/history/${logId}/undo`, token, { method: 'POST' })
}

export async function clearCategoryHistory(token: string): Promise<void> {
  return apiFetch<void>('/categories/history/all', token, { method: 'DELETE' })
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

// ── Subscriptions ──────────────────────────────────────────────────────────

export interface SubscriptionInfo {
  tier: 'free' | 'pro'
  period_type: 'monthly' | 'annual' | null
  trial_ends_at: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
}

export async function getSubscription(token: string): Promise<SubscriptionInfo> {
  return apiFetch<SubscriptionInfo>('/subscriptions/me', token)
}

// ── Plaid ──────────────────────────────────────────────────────────────────

export async function getLinkToken(
  token: string,
  redirectUri?: string,
): Promise<{ link_token: string }> {
  return apiFetch<{ link_token: string }>('/plaid/link-token', token, {
    method: 'POST',
    body: JSON.stringify({ redirect_uri: redirectUri ?? null }),
  })
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
