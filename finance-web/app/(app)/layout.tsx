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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <AuthTokenContext.Provider value={session?.access_token ?? null}>
      <div className="flex min-h-screen">
        <NavSidebar session={session} />
        <main className="flex-1 p-6 overflow-y-auto min-h-screen">{children}</main>
      </div>
    </AuthTokenContext.Provider>
  )
}
