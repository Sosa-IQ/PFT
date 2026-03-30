'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Status = 'waiting' | 'ready' | 'invalid'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('waiting')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Only the PASSWORD_RECOVERY event (fired when arriving via the email link)
    // unlocks the form. A logged-in user visiting this URL directly never gets
    // this event, so they'll always see the invalid/expired state.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStatus('ready')
      }
    })

    // If no PASSWORD_RECOVERY event fires within 3 seconds, treat the link as invalid.
    const timeout = setTimeout(() => {
      setStatus((current) => current === 'waiting' ? 'invalid' : current)
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      await supabase.auth.signOut()
      router.replace('/login')
    }
  }

  return (
    <main className="app-shell min-h-screen px-4">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center py-12">
        <div className="app-panel w-full max-w-md rounded-3xl p-8 sm:p-10">
        {status === 'waiting' && (
          <p className="text-center text-sm text-cream-muted">Verifying reset link…</p>
        )}

        {status === 'invalid' && (
          <>
            <h1 className="mb-2 text-2xl font-semibold text-cream">Link expired</h1>
            <p className="text-sm text-cream-muted">
              This reset link is invalid or has expired.{' '}
              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  router.replace('/login')
                }}
                className="text-accent-text dark:text-accent hover:underline"
              >
                Request a new one.
              </button>
            </p>
          </>
        )}

        {status === 'ready' && (
          <>
            <h1 className="mb-1 text-2xl font-semibold text-cream">Set new password</h1>
            <p className="mb-6 text-sm text-cream-muted">Choose a new password for your account.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-cream">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
      </div>
    </main>
  )
}
