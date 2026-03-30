'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      // Supabase sends a confirmation email unless email confirmation is disabled.
      setDone(true)
    }
  }

  if (done) {
    return (
      <div className="app-panel w-full max-w-md space-y-3 rounded-3xl p-8 text-center sm:p-10">
        <div className="text-4xl">📬</div>
        <h2 className="text-xl font-semibold text-cream">Check your email</h2>
        <p className="text-sm text-cream-muted">
          We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
          account, then{' '}
          <Link href="/login" className="text-accent-text dark:text-accent hover:underline">
            sign in
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="app-panel w-full max-w-md rounded-3xl p-8 sm:p-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-surface-raised ring-1 ring-surface-border">
          <Image src="/BudgitBuddy.png" alt="Budgit Buddy mascot" fill sizes="56px" className="object-contain p-1.5" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight"><span className="text-accent">Budgit</span> <span className="text-warning-display">Buddy</span></p>
          <p className="text-sm text-cream-muted">Set up your account and start tracking</p>
        </div>
      </div>

      <h1 className="mb-1 text-2xl font-semibold text-cream">Create account</h1>
      <p className="mb-6 text-sm text-cream-muted">Start tracking your finances with the same app theme everywhere.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-cream">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

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
          <label className="mb-1 block text-sm font-medium text-cream">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-cream">Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-sm text-cream focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-cream-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-accent-text dark:text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
