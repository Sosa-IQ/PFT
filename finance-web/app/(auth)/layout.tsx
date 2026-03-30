'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// If the user is already logged in, skip auth pages and go straight to the dashboard.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
    })
  }, [router])

  return (
    <main className="app-shell min-h-screen px-4">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center py-12">
        {children}
      </div>
    </main>
  )
}
