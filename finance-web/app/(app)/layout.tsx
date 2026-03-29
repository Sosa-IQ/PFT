'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthTokenContext } from '@/hooks/useAuthToken'
import NavSidebar from '@/components/NavSidebar'

// Protected layout — redirects to /login if the user is not authenticated.
// All pages under (app)/ are wrapped with this sidebar layout.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check the initial session.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setSession(session)
        setLoading(false)
      }
    })

    // Listen for auth state changes (e.g. token refresh, sign out).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/login')
      } else {
        setSession(session)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (loading) {
    return (
      <div className="app-shell min-h-screen flex items-center justify-center">
        <p className="text-cream-muted text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <AuthTokenContext.Provider value={session?.access_token ?? null}>
      <div className="app-shell flex min-h-screen text-cream">
        <NavSidebar session={session} />
        <main className="flex-1 min-h-screen overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </AuthTokenContext.Provider>
  )
}
