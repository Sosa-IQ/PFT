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
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        {status === 'waiting' && (
          <p className="text-sm text-gray-500 text-center">Verifying reset link…</p>
        )}

        {status === 'invalid' && (
          <>
            <h1 className="text-2xl font-semibold mb-2">Link expired</h1>
            <p className="text-sm text-gray-500">
              This reset link is invalid or has expired.{' '}
              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  router.replace('/login')
                }}
                className="text-blue-600 hover:underline"
              >
                Request a new one.
              </button>
            </p>
          </>
        )}

        {status === 'ready' && (
          <>
            <h1 className="text-2xl font-semibold mb-1">Set new password</h1>
            <p className="text-sm text-gray-500 mb-6">Choose a new password for your account.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
