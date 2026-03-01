'use client'

import { useState } from 'react'
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from '@/hooks/queries'
import type { Goal } from '@/lib/api'
import GoalCard from '@/components/GoalCard'

export default function GoalsPage() {
  const { data: goals = [], isLoading, error } = useGoals()
  const createGoal = useCreateGoal()
  const updateGoalMut = useUpdateGoal()
  const deleteGoalMut = useDeleteGoal()

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

  if (isLoading) return <p className="text-gray-400 text-sm py-16 text-center">Loading…</p>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Savings Goals</h1>
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + New Goal
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {error instanceof Error ? error.message : 'Failed to load goals'}
        </div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSave}
          className="bg-white rounded-xl border border-gray-200 p-5 space-y-4"
        >
          <h2 className="font-semibold text-gray-800">
            {editingId ? 'Edit Goal' : 'New Goal'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Goal name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                placeholder="e.g. Emergency Fund"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target amount ($)</label>
              <input
                type="number"
                value={formTarget}
                onChange={(e) => setFormTarget(e.target.value)}
                required
                min="0.01"
                step="0.01"
                placeholder="5000.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current amount ($)</label>
              <input
                type="number"
                value={formCurrent}
                onChange={(e) => setFormCurrent(e.target.value)}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deadline <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="date"
                value={formDeadline}
                onChange={(e) => setFormDeadline(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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

      {/* Goal Cards */}
      {goals.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">
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
