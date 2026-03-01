'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { exchangePlaidToken } from '@/lib/api'
import { usePlaidLink } from 'react-plaid-link'

/**
 * OAuth callback page for Plaid Link.
 *
 * When a production bank uses OAuth, Plaid redirects the user here after
 * they authenticate with their bank. This page re-initializes Plaid Link
 * with the receivedRedirectUri to complete the token exchange.
 *
 * The link_token is stored in sessionStorage before opening Plaid Link
 * so it can be retrieved here after the redirect.
 */

function OAuthLinkHandler({ linkToken, authToken }: { linkToken: string; authToken: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const onSuccess = useCallback(async (publicToken: string) => {
    try {
      await exchangePlaidToken(authToken, publicToken)
      router.push('/settings')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed')
    }
  }, [authToken, router])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri: window.location.href,
    onSuccess,
    onExit: (err) => {
      if (err) setError(err.error_message ?? 'Plaid Link closed')
      else router.push('/settings')
    },
  })

  useEffect(() => {
    if (ready) open()
  }, [ready, open])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={() => router.push('/settings')}
            className="text-sm text-blue-600 hover:underline"
          >
            Back to Settings
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500 text-sm">Completing bank connection...</p>
    </div>
  )
}

export default function OAuthCallbackPage() {
  const router = useRouter()
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      // Retrieve the link token that was stored before opening Plaid Link.
      const storedToken = sessionStorage.getItem('plaid_link_token')
      if (!storedToken) {
        setError('Missing link token. Please try connecting your bank again from Settings.')
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      setLinkToken(storedToken)
      setAuthToken(session.access_token)
    }
    init()
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={() => router.push('/settings')}
            className="text-sm text-blue-600 hover:underline"
          >
            Back to Settings
          </button>
        </div>
      </div>
    )
  }

  if (!linkToken || !authToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  return <OAuthLinkHandler linkToken={linkToken} authToken={authToken} />
}
