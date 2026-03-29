'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getLinkToken } from '@/lib/api'
import { usePlaidLink } from 'react-plaid-link'
import { useAuthToken } from '@/hooks/useAuthToken'
import { useAccounts, useSyncTransactions, useExchangePlaidToken } from '@/hooks/queries'

// Inner component that has access to the Plaid link token and uses the hook.
function PlaidLinkButton({
  token,
  onSuccess,
  onExit,
}: {
  token: string
  onSuccess: (publicToken: string) => void
  onExit: (errorMessage: string | null) => void
}) {
  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (public_token: string) => onSuccess(public_token),
    onExit: (err) => {
      onExit(err?.error_message ?? null)
    },
  })

  // Auto-open the Plaid modal as soon as it's ready — avoids requiring a second click.
  useEffect(() => {
    if (ready) open()
  }, [ready, open])

  return null
}

// ---------------------------------------------------------------------------
// Connect Claude card — shows MCP server config for Claude Desktop
// ---------------------------------------------------------------------------

function ClaudeConnectCard() {
  const mcpUrl = process.env.NEXT_PUBLIC_MCP_SERVER_URL ?? ''
  const sseUrl = mcpUrl ? `${mcpUrl}/sse` : 'https://mcp.budgitbuddy.com/sse'

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
    <section className="app-panel rounded-3xl p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-cream">Connect Claude</h2>
        <p className="text-sm text-cream-muted mt-1">
          Add the MCP server to Claude Desktop to ask Claude about your finances.
        </p>
      </div>

      <ol className="text-sm text-cream-muted space-y-1.5 list-decimal list-inside">
        <li>Open Claude Desktop → Settings → Developer → Edit Config</li>
        <li>Paste the snippet below into <code className="font-mono text-xs bg-surface px-1 py-0.5 rounded">claude_desktop_config.json</code></li>
        <li>Save the file and restart Claude Desktop</li>
        <li>A browser window will open — sign in with your account once</li>
      </ol>

      <div className="relative">
        <pre className="bg-surface border border-surface-border rounded-xl p-4 text-xs font-mono text-cream overflow-x-auto">
          {config}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute right-3 top-3 rounded-lg border border-surface-border bg-surface-raised px-2.5 py-1 text-xs text-cream-muted transition-colors hover:text-cream"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const authToken = useAuthToken()
  const { data: accounts = [], isLoading } = useAccounts()
  const syncMutation = useSyncTransactions()
  const exchangeMutation = useExchangePlaidToken()

  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  const [nameInput, setNameInput] = useState<string>('')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const name = (user.user_metadata?.full_name as string | undefined) ?? ''
      setUserEmail(user.email ?? '')
      setUserName(name)
      setNameInput(name)
    })
  }, [])

  async function handleSaveName() {
    setSavingName(true)
    setNameSaved(false)
    const { error } = await supabase.auth.updateUser({ data: { full_name: nameInput } })
    setSavingName(false)
    if (!error) {
      setUserName(nameInput)
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 2500)
    }
  }

  // Plaid link token (fetched from backend when user clicks "Connect").
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [fetchingLink, setFetchingLink] = useState(false)

  // Fetch a Plaid link token when the user wants to connect a bank.
  // Pass the OAuth redirect URI so production banks using OAuth work correctly.
  async function handleGetLinkToken() {
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
    setError(null)
    try {
      await syncMutation.mutateAsync()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    }
  }

  const handlePlaidSuccess = useCallback(async (publicToken: string) => {
    try {
      await exchangeMutation.mutateAsync(publicToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    }
    setLinkToken(null)
  }, [exchangeMutation])

  const handlePlaidExit = useCallback((errorMessage: string | null) => {
    setLinkToken(null)
    if (errorMessage) setError(errorMessage)
  }, [])

  if (isLoading) return <p className="text-cream-muted text-sm py-16 text-center">Loading…</p>

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold text-cream">Settings</h1>

      {error && (
        <div className="rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Connect Bank */}
      <section className="app-panel rounded-3xl p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-cream">Connect Bank Account</h2>
          <p className="text-sm text-cream-muted mt-1">
            Link your bank via Plaid to automatically import transactions and balances.
          </p>
        </div>

        {!linkToken ? (
          <button
            onClick={handleGetLinkToken}
            disabled={fetchingLink}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {fetchingLink ? 'Preparing…' : 'Connect Bank Account'}
          </button>
        ) : (
          <PlaidLinkButton
            token={linkToken}
            onSuccess={handlePlaidSuccess}
            onExit={handlePlaidExit}
          />
        )}
      </section>

      {/* Connected Accounts */}
      <section className="app-panel rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-cream">Connected Accounts</h2>
          {accounts.length > 0 && (
            <button
              onClick={handleSync}
              disabled={syncMutation.isPending}
              className="text-sm text-accent hover:underline disabled:opacity-50"
            >
              {syncMutation.isPending ? 'Syncing…' : 'Sync now'}
            </button>
          )}
        </div>

        {syncMutation.data && (
          <div className="rounded-lg border border-accent/25 bg-accent/10 px-4 py-2 text-sm text-accent">
            Sync complete — {syncMutation.data.added} added, {syncMutation.data.modified} updated,{' '}
            {syncMutation.data.removed} removed.
          </div>
        )}

        {accounts.length === 0 ? (
          <p className="text-sm text-cream-muted">
            No accounts connected yet. Use the button above to link your bank.
          </p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-cream">{a.account_name}</p>
                  <p className="text-xs text-cream-muted capitalize">
                    {[a.institution_name, a.account_type].filter(Boolean).join(' · ')}
                  </p>
                  {a.last_synced_at && (
                    <p className="text-xs text-cream-muted mt-0.5">
                      Last synced:{' '}
                      {new Date(a.last_synced_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
                <p className="text-sm font-semibold text-cream">
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
      <section className="app-panel rounded-3xl p-6 space-y-4">
        <h2 className="font-semibold text-cream">Account</h2>

        <div className="space-y-3">
          {/* Email — read-only */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-cream-muted uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={userEmail}
              readOnly
              className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-cream-muted cursor-default select-all"
            />
          </div>

          {/* Name — editable */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-cream-muted uppercase tracking-wide">Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your name"
                className="flex-1 rounded-lg border border-surface-border px-3 py-2 text-sm text-cream bg-surface-card focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                onClick={handleSaveName}
                disabled={savingName || nameInput === userName || nameInput.trim() === ''}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {savingName ? 'Saving…' : nameSaved ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={async () => {
            await supabase.auth.signOut()
            window.location.href = '/login'
          }}
          className="text-sm text-danger hover:underline"
        >
          Sign out
        </button>
      </section>
    </div>
  )
}
