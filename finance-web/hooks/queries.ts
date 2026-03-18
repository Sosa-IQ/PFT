import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  getTransactions,
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetLines,
  createBudgetLine,
  updateBudgetLine,
  deleteBudgetLine,
  reorderBudgetLines,
  excludeTransaction,
  includeTransaction,
  getTransactionCategories,
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  getLiabilities,
  createLiability,
  updateLiability,
  deleteLiability,
  syncTransactions,
  exchangePlaidToken,
  type Transaction,
  type Budget,
  type BudgetLine,
  type Goal,
  type Liability,
} from '@/lib/api'
import { useAuthToken } from './useAuthToken'

// ── Query Keys ────────────────────────────────────────────────────────────

export const queryKeys = {
  accounts: ['accounts'] as const,
  debtAccounts: ['accounts', 'debt'] as const,
  transactions: (filters?: Record<string, unknown>) => ['transactions', filters ?? {}] as const,
  budgets: ['budgets'] as const,
  goals: ['goals'] as const,
  liabilities: ['liabilities'] as const,
}

// ── Account types (shared across pages) ───────────────────────────────────

export interface Account {
  id: string
  account_name: string
  account_type: string
  current_balance: number
  institution_name: string | null
  last_synced_at?: string | null
}

// ── Accounts (queried directly via Supabase) ──────────────────────────────

export function useAccounts() {
  return useQuery<Account[]>({
    queryKey: queryKeys.accounts,
    queryFn: async () => {
      const { data } = await supabase
        .from('accounts')
        .select('id, account_name, account_type, current_balance, institution_name, last_synced_at')
        .order('current_balance', { ascending: false })
      return data ?? []
    },
    staleTime: 10 * 60 * 1000, // 10 minutes — Plaid data only changes on sync
  })
}

export function useDebtAccounts() {
  return useQuery<Account[]>({
    queryKey: queryKeys.debtAccounts,
    queryFn: async () => {
      const { data } = await supabase
        .from('accounts')
        .select('id, account_name, account_type, current_balance, institution_name')
        .in('account_type', ['credit', 'loan'])
        .order('current_balance', { ascending: false })
      return data ?? []
    },
    staleTime: 10 * 60 * 1000,
  })
}

// ── Transactions ──────────────────────────────────────────────────────────

export function useTransactions(filters: {
  category?: string
  start_date?: string
  end_date?: string
  limit?: number
} = {}) {
  const token = useAuthToken()
  return useQuery<Transaction[]>({
    queryKey: queryKeys.transactions(filters),
    queryFn: () => getTransactions(token, filters),
  })
}

// ── Budgets ───────────────────────────────────────────────────────────────

export function useBudgets() {
  const token = useAuthToken()
  return useQuery<Budget[]>({
    queryKey: queryKeys.budgets,
    queryFn: () => getBudgets(token),
  })
}

export function useCreateBudget() {
  const token = useAuthToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string
      date_range_type: 'custom' | 'weekly' | 'biweekly' | 'monthly'
      start_date?: string
      end_date?: string
    }) => createBudget(token, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.budgets }) },
  })
}

export function useUpdateBudget() {
  const token = useAuthToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; date_range_type?: string; start_date?: string; end_date?: string }) =>
      updateBudget(token, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.budgets }) },
  })
}

export function useDeleteBudget() {
  const token = useAuthToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBudget(token, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.budgets }) },
  })
}

// ── Budget Lines ──────────────────────────────────────────────────────────

export function useBudgetLines(budgetId: string) {
  const token = useAuthToken()
  return useQuery<BudgetLine[]>({
    queryKey: [...queryKeys.budgets, budgetId, 'lines'],
    queryFn: () => getBudgetLines(token, budgetId),
    enabled: !!budgetId,
  })
}

export function useCreateBudgetLine(budgetId: string) {
  const token = useAuthToken()
  return useMutation({
    mutationFn: (data: {
      line_type: 'income' | 'expense'
      name: string
      categories?: string[]
      planned_amount: number
    }) => createBudgetLine(token, budgetId, data),
  })
}

export function useUpdateBudgetLine(budgetId: string) {
  const token = useAuthToken()
  const qc = useQueryClient()
  const linesKey = [...queryKeys.budgets, budgetId, 'lines']
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; categories?: string[]; planned_amount?: number }) =>
      updateBudgetLine(token, budgetId, id, data),
    onMutate: async (updated) => {
      await qc.cancelQueries({ queryKey: linesKey })
      const prev = qc.getQueryData<BudgetLine[]>(linesKey)
      qc.setQueryData<BudgetLine[]>(linesKey, (old) =>
        (old ?? []).map((l) => l.id === updated.id ? { ...l, ...updated } : l)
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(linesKey, ctx.prev)
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: linesKey }) },
  })
}

export function useDeleteBudgetLine(budgetId: string) {
  const token = useAuthToken()
  const qc = useQueryClient()
  const linesKey = [...queryKeys.budgets, budgetId, 'lines']
  return useMutation({
    mutationFn: (lineId: string) => deleteBudgetLine(token, budgetId, lineId),
    onMutate: async (lineId) => {
      await qc.cancelQueries({ queryKey: linesKey })
      const prev = qc.getQueryData<BudgetLine[]>(linesKey)
      qc.setQueryData<BudgetLine[]>(linesKey, (old) =>
        (old ?? []).filter((l) => l.id !== lineId)
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(linesKey, ctx.prev)
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: linesKey }) },
  })
}

export function useReorderBudgetLines(budgetId: string) {
  const token = useAuthToken()
  const qc = useQueryClient()
  const linesKey = [...queryKeys.budgets, budgetId, 'lines']
  return useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      reorderBudgetLines(token, budgetId, items),
    // On error, refetch from server so the UI reverts to the actual saved order.
    // We intentionally do NOT invalidate on success — the optimistic cache update
    // in handleDrop is already correct, and refetching would race with the local state.
    onError: () => { qc.invalidateQueries({ queryKey: linesKey }) },
  })
}

export function useExcludeTransaction(budgetId: string) {
  const token = useAuthToken()
  const qc = useQueryClient()
  const linesKey = [...queryKeys.budgets, budgetId, 'lines']
  return useMutation({
    mutationFn: ({ lineId, transactionId }: { lineId: string; transactionId: string; amount: number }) =>
      excludeTransaction(token, budgetId, lineId, transactionId),
    onMutate: async ({ lineId, transactionId, amount }) => {
      await qc.cancelQueries({ queryKey: linesKey })
      const prev = qc.getQueryData<BudgetLine[]>(linesKey)
      const contribution = Math.abs(amount)
      qc.setQueryData<BudgetLine[]>(linesKey, (old) =>
        (old ?? []).map((l) =>
          l.id === lineId
            ? {
                ...l,
                excluded_transaction_ids: [...l.excluded_transaction_ids, transactionId],
                computed_actual: l.computed_actual != null
                  ? Math.max(0, l.computed_actual - contribution)
                  : null,
              }
            : l
        )
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(linesKey, ctx.prev)
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: linesKey }) },
  })
}

export function useIncludeTransaction(budgetId: string) {
  const token = useAuthToken()
  const qc = useQueryClient()
  const linesKey = [...queryKeys.budgets, budgetId, 'lines']
  return useMutation({
    mutationFn: ({ lineId, transactionId }: { lineId: string; transactionId: string; amount: number }) =>
      includeTransaction(token, budgetId, lineId, transactionId),
    onMutate: async ({ lineId, transactionId, amount }) => {
      await qc.cancelQueries({ queryKey: linesKey })
      const prev = qc.getQueryData<BudgetLine[]>(linesKey)
      const contribution = Math.abs(amount)
      qc.setQueryData<BudgetLine[]>(linesKey, (old) =>
        (old ?? []).map((l) =>
          l.id === lineId
            ? {
                ...l,
                excluded_transaction_ids: l.excluded_transaction_ids.filter((id) => id !== transactionId),
                computed_actual: l.computed_actual != null
                  ? l.computed_actual + contribution
                  : null,
              }
            : l
        )
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(linesKey, ctx.prev)
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: linesKey }) },
  })
}

export function useTransactionCategories() {
  const token = useAuthToken()
  return useQuery<string[]>({
    queryKey: ['transaction-categories'],
    queryFn: () => getTransactionCategories(token),
    staleTime: 5 * 60 * 1000,
  })
}

// ── Goals ─────────────────────────────────────────────────────────────────

export function useGoals() {
  const token = useAuthToken()
  return useQuery<Goal[]>({
    queryKey: queryKeys.goals,
    queryFn: () => getGoals(token),
  })
}

export function useCreateGoal() {
  const token = useAuthToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; target_amount: number; current_amount?: number; deadline?: string }) =>
      createGoal(token, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.goals }) },
  })
}

export function useUpdateGoal() {
  const token = useAuthToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; target_amount?: number; current_amount?: number; deadline?: string }) =>
      updateGoal(token, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.goals }) },
  })
}

export function useDeleteGoal() {
  const token = useAuthToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteGoal(token, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.goals }) },
  })
}

// ── Liabilities ───────────────────────────────────────────────────────────

export function useLiabilities() {
  const token = useAuthToken()
  return useQuery<Liability[]>({
    queryKey: queryKeys.liabilities,
    queryFn: () => getLiabilities(token),
  })
}

export function useCreateLiability() {
  const token = useAuthToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; balance: number; apr?: number; type?: string; minimum_payment?: number }) =>
      createLiability(token, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.liabilities }) },
  })
}

export function useUpdateLiability() {
  const token = useAuthToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; balance?: number; apr?: number; type?: string; minimum_payment?: number }) =>
      updateLiability(token, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.liabilities }) },
  })
}

export function useDeleteLiability() {
  const token = useAuthToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteLiability(token, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.liabilities }) },
  })
}

// ── Plaid Sync ────────────────────────────────────────────────────────────

export function useSyncTransactions() {
  const token = useAuthToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => syncTransactions(token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useExchangePlaidToken() {
  const token = useAuthToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (publicToken: string) => exchangePlaidToken(token, publicToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
