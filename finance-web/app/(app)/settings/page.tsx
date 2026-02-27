'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getLinkToken, exchangePlaidToken, syncTransactions, type SyncResult } from '@/lib/api'
import { usePlaidLink } from 'react-plaid-link'

interface Account {
  id: string
  account_name: string
  account_type: string
  institution_name: string | null
  current_balance: number
  last_synced_at: string | null
}

// Inner component that has access to the Plaid link token and uses the hook.
function PlaidLinkButton({
  token,
  authToken,
  onSuccess,
}: {
  token: string
  authToken: string
  onSuccess: () => void
}) {
  const [connecting, setConnecting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const { open, ready } = usePlaidLink({
    token,
    onSuccess: async (public_token) => {
      setConnecting(true)
      setErr(null)
      try {
        await exchangePlaidToken(authToken, public_token)
        onSuccess()
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Connection failed')
      } finally {
        setConnecting(false)
      }
    },
    onExit: (err) => {
      if (err) setErr(err.error_message ?? 'Plaid Link closed with an error.')
    },
  })

  return (
    <div className="space-y-2">
      <button
        onClick={() => open()}
        disabled={!ready || connecting}
        className="bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {connecting ? 'Connecting…' : 'Connect Bank Account'}
      </button>
      {err && <p className="text-sm text-red-500">{err}</p>}
    </div>
  )
}

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)

  // Plaid link token (fetched from backend when user clicks "Connect").
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [fetchingLink, setFetchingLink] = useState(false)

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

  async function loadAccounts() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setAuthToken(session.access_token)
    const { data } = await supabase
      .from('accounts')
      .select('id, account_name, account_type, institution_name, current_balance, last_synced_at')
      .order('institution_name')
    setAccounts(data ?? [])
  }

  useEffect(() => {
    loadAccounts()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load accounts'))
      .finally(() => setLoading(false))
  }, [])

  // Fetch a Plaid link token when the user wants to connect a bank.
  async function handleGetLinkToken() {
    if (!authToken) return
    setFetchingLink(true)
    setError(null)
    try {
      const { link_token } = await getLinkToken(authToken)
      setLinkToken(link_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get link token')
    } finally {
      setFetchingLink(false)
    }
  }

  async function handleSync() {
    if (!authToken) return
    setSyncing(true)
    setSyncResult(null)
    setError(null)
    try {
      const result = await syncTransactions(authToken)
      setSyncResult(result)
      await loadAccounts() // Refresh balances after sync
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  function handlePlaidSuccess() {
    setLinkToken(null)
    loadAccounts()
  }

  if (loading) return <p className="text-gray-400 text-sm py-16 text-center">Loading…</p>

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Connect Bank */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-800">Connect Bank Account</h2>
          <p className="text-sm text-gray-500 mt-1">
            Link your bank via Plaid to automatically import transactions and balances.
          </p>
        </div>

        {!linkToken ? (
          <button
            onClick={handleGetLinkToken}
            disabled={fetchingLink}
            className="bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {fetchingLink ? 'Preparing…' : 'Connect Bank Account'}
          </button>
        ) : (
          <PlaidLinkButton
            token={linkToken}
            authToken={authToken!}
            onSuccess={handlePlaidSuccess}
          />
        )}
      </section>

      {/* Connected Accounts */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Connected Accounts</h2>
          {accounts.length > 0 && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-sm text-blue-600 hover:underline disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          )}
        </div>

        {syncResult && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2">
            Sync complete — {syncResult.added} added, {syncResult.modified} updated,{' '}
            {syncResult.removed} removed.
          </div>
        )}

        {accounts.length === 0 ? (
          <p className="text-sm text-gray-400">
            No accounts connected yet. Use the button above to link your bank.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{a.account_name}</p>
                  <p className="text-xs text-gray-400 capitalize">
                    {[a.institution_name, a.account_type].filter(Boolean).join(' · ')}
                  </p>
                  {a.last_synced_at && (
                    <p className="text-xs text-gray-300 mt-0.5">
                      Last synced:{' '}
                      {new Date(a.last_synced_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-700">
                  $
                  {(a.current_balance ?? 0).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Account */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
        <h2 className="font-semibold text-gray-800">Account</h2>
        <p className="text-sm text-gray-500">
          Signed in as{' '}
          <span className="font-medium text-gray-700">
            {/* Session email shown in sidebar */}
            your account
          </span>
        </p>
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            window.location.href = '/login'
          }}
          className="text-sm text-red-500 hover:underline"
        >
          Sign out
        </button>
      </section>
    </div>
  )
}
