'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    queryClient.clear()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      router.replace('/dashboard')
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email address above, then click "Forgot password?".')
      return
    }
    setError(null)
    setResetLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setResetSent(true)
    }
  }

  return (
    <div className="app-panel w-full max-w-md rounded-3xl p-8 sm:p-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-surface-raised ring-1 ring-surface-border">
          <Image src="/BudgitBuddy.png" alt="BudgIt Buddy mascot" fill sizes="56px" className="object-contain p-1.5" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight"><span className="text-accent">BudgIt</span> <span className="text-warning-display">Buddy</span></p>
          <p className="text-sm text-cream-muted">Welcome back to your finance hub</p>
        </div>
      </div>

      <h1 className="mb-1 text-2xl font-semibold text-cream">Sign in</h1>
      <p className="mb-6 text-sm text-cream-muted">Access your dashboard, budgets, and synced accounts.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-cream">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-cream">Password</label>
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              className="text-xs text-accent-text dark:text-accent hover:underline disabled:opacity-50"
            >
              {resetLoading ? 'Sending…' : 'Forgot password?'}
            </button>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {resetSent && (
          <p className="text-sm text-accent-text dark:text-accent">
            Password reset email sent. Check your inbox.
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-cream-muted">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-accent-text dark:text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
