'use client'

import { useCallback, useEffect, useState } from 'react'
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
  onExit,
}: {
  token: string
  authToken: string
  onSuccess: () => void
  onExit: (errorMessage: string | null) => void
}) {
  const [connecting, setConnecting] = useState(false)

  const onPlaidSuccess = useCallback(async (public_token: string) => {
    setConnecting(true)
    try {
      await exchangePlaidToken(authToken, public_token)
      onSuccess()
    } catch (e) {
      onExit(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }, [authToken, onSuccess, onExit])

  const { open, ready } = usePlaidLink({
    token,
    onSuccess: onPlaidSuccess,
    onExit: (err) => {
      onExit(err?.error_message ?? null)
    },
  })

  // Auto-open the Plaid modal as soon as it's ready — avoids requiring a second click.
  useEffect(() => {
    if (ready) open()
  }, [ready, open])

  return connecting ? <p className="text-sm text-gray-500">Connecting…</p> : null
}

// ---------------------------------------------------------------------------
// Connect Claude card — shows MCP server config for Claude Desktop
// ---------------------------------------------------------------------------

function ClaudeConnectCard() {
  const mcpUrl = process.env.NEXT_PUBLIC_MCP_SERVER_URL ?? ''
  const sseUrl = mcpUrl ? `${mcpUrl}/sse` : 'https://your-mcp-server.railway.app/sse'

  const config = JSON.stringify(
    { mcpServers: { finance: { url: sseUrl } } },
    null,
    2
  )

  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(config)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API unavailable (e.g. non-HTTPS dev)
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-800">Connect Claude</h2>
        <p className="text-sm text-gray-500 mt-1">
          Add the MCP server to Claude Desktop to ask Claude about your finances.
        </p>
      </div>

      <ol className="text-sm text-gray-600 space-y-1.5 list-decimal list-inside">
        <li>Open Claude Desktop → Settings → Developer → Edit Config</li>
        <li>Paste the snippet below into <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">claude_desktop_config.json</code></li>
        <li>Save the file and restart Claude Desktop</li>
        <li>A browser window will open — sign in with your account once</li>
      </ol>

      <div className="relative">
        <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs font-mono text-gray-700 overflow-x-auto">
          {config}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 text-xs bg-white border border-gray-200 text-gray-600 hover:text-gray-900 rounded-lg px-2.5 py-1 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------

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
  // Pass the OAuth redirect URI so production banks using OAuth work correctly.
  async function handleGetLinkToken() {
    if (!authToken) return
    setFetchingLink(true)
    setError(null)
    try {
      // Only pass redirect_uri on HTTPS — Plaid requires it and localhost is HTTP.
      const isHttps = window.location.protocol === 'https:'
      const redirectUri = isHttps ? `${window.location.origin}/oauth-callback` : undefined
      const { link_token } = await getLinkToken(authToken, redirectUri)
      // Store the link token so the OAuth callback page can retrieve it after redirect.
      sessionStorage.setItem('plaid_link_token', link_token)
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

  function handlePlaidExit(errorMessage: string | null) {
    setLinkToken(null)
    if (errorMessage) setError(errorMessage)
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
            onExit={handlePlaidExit}
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

      {/* Connect Claude */}
      <ClaudeConnectCard />

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
