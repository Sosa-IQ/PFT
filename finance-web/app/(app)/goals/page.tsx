'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from '@/hooks/queries'
import type { Goal } from '@/lib/api'
import GoalCard from '@/components/GoalCard'
import { useSubscription } from '@/hooks/useSubscription'

export default function GoalsPage() {
  const { data: goals = [], isLoading, error } = useGoals()
  const createGoal = useCreateGoal()
  const updateGoalMut = useUpdateGoal()
  const deleteGoalMut = useDeleteGoal()
  const { isPro } = useSubscription()

  // Form state — shared for create and edit.
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formTarget, setFormTarget] = useState('')
  const [formCurrent, setFormCurrent] = useState('')
  const [formDeadline, setFormDeadline] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  function openAdd() {
    setEditingId(null)
    setFormName('')
    setFormTarget('')
    setFormCurrent('')
    setFormDeadline('')
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(goal: Goal) {
    setEditingId(goal.id)
    setFormName(goal.name)
    setFormTarget(String(goal.target_amount))
    setFormCurrent(String(goal.current_amount))
    setFormDeadline(goal.deadline ?? '')
    setFormError(null)
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const target = parseFloat(formTarget)
    const current = parseFloat(formCurrent || '0')
    if (isNaN(target) || target <= 0) {
      setFormError('Target amount must be a positive number.')
      return
    }
    if (isNaN(current) || current < 0) {
      setFormError('Current amount must be 0 or more.')
      return
    }
    try {
      if (editingId) {
        await updateGoalMut.mutateAsync({
          id: editingId,
          name: formName.trim(),
          target_amount: target,
          current_amount: current,
          deadline: formDeadline || undefined,
        })
      } else {
        await createGoal.mutateAsync({
          name: formName.trim(),
          target_amount: target,
          current_amount: current,
          deadline: formDeadline || undefined,
        })
      }
      setShowForm(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete goal "${name}"?`)) return
    try {
      await deleteGoalMut.mutateAsync(id)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const saving = createGoal.isPending || updateGoalMut.isPending

  if (isLoading) return <p className="text-cream-muted text-sm py-16 text-center">Loading…</p>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {!isPro && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-accent/30 bg-accent/8 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-cream">Savings Goals is a Pro feature</p>
            <p className="text-xs text-cream-muted mt-0.5">Upgrade to track unlimited goals and stay on target.</p>
          </div>
          <Link
            href="/billing"
            className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast hover:bg-accent-hover transition-colors"
          >
            Upgrade
          </Link>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-cream">Savings Goals</h1>
        <button
          onClick={openAdd}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
        >
          + New Goal
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error instanceof Error ? error.message : 'Failed to load goals'}
        </div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSave}
          className="app-panel rounded-2xl p-5 space-y-4"
        >
          <h2 className="font-semibold text-cream">
            {editingId ? 'Edit Goal' : 'New Goal'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-cream mb-1">Goal name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                placeholder="e.g. Emergency Fund"
                className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm bg-surface text-cream focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-cream mb-1">Target amount ($)</label>
              <input
                type="number"
                value={formTarget}
                onChange={(e) => setFormTarget(e.target.value)}
                required
                min="0.01"
                step="0.01"
                placeholder="5000.00"
                className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm bg-surface text-cream focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-cream mb-1">Current amount ($)</label>
              <input
                type="number"
                value={formCurrent}
                onChange={(e) => setFormCurrent(e.target.value)}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm bg-surface text-cream focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-cream mb-1">
                Deadline <span className="text-cream-muted">(optional)</span>
              </label>
              <input
                type="date"
                value={formDeadline}
                onChange={(e) => setFormDeadline(e.target.value)}
                className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm bg-surface text-cream focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {formError && <p className="text-sm text-danger">{formError}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-cream-muted rounded-lg px-4 py-2 text-sm hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Goal Cards */}
      {goals.length === 0 ? (
        <p className="text-sm text-cream-muted text-center py-12">
          No savings goals yet. Create one to start tracking your progress.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              {...g}
              onEdit={() => openEdit(g)}
              onDelete={() => handleDelete(g.id, g.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
