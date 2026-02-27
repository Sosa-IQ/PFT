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
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 px-4">
      {children}
    </main>
  )
}
