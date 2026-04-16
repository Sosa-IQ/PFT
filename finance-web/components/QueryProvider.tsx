'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

function AuthCacheBoundary({ queryClient }: { queryClient: QueryClient }) {
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) userIdRef.current = session?.user.id ?? null
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null
      const previousUserId = userIdRef.current

      if (event === 'SIGNED_OUT' || (previousUserId && nextUserId && previousUserId !== nextUserId)) {
        queryClient.clear()
      }

      userIdRef.current = nextUserId
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [queryClient])

  return null
}

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,  // 5 minutes
            gcTime: 30 * 60 * 1000,     // 30 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthCacheBoundary queryClient={queryClient} />
      {children}
    </QueryClientProvider>
  )
}
