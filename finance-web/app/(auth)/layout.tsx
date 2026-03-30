'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// If the user is already logged in, skip auth pages and go straight to the dashboard.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard')
        return
      }

      setCheckingSession(false)
    })
  }, [router])

  if (checkingSession) {
    return (
      <main className="app-shell min-h-screen px-4">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center py-12">
          <p className="text-sm text-cream-muted">Loading…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="app-shell min-h-screen px-4">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center py-12">
        {children}
      </div>
    </main>
  )
}
