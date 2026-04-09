'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getLinkToken } from '@/lib/api'
import { usePlaidLink } from 'react-plaid-link'
import { useAuthToken } from '@/hooks/useAuthToken'
import { useAccounts, useSyncTransactions, useExchangePlaidToken } from '@/hooks/queries'
import { useSubscription } from '@/hooks/useSubscription'
import UpgradeModal from '@/components/UpgradeModal'

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
// Developer Tools card — MCP server connection config for multiple AI clients
// ---------------------------------------------------------------------------

type ClientTab = {
  id: string
  label: string
  configPath: string
  snippet: (sseUrl: string) => string
  steps: (sseUrl: string) => React.ReactNode[]
}

const CLIENT_TABS: ClientTab[] = [
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    configPath: 'claude_desktop_config.json',
    snippet: (sseUrl) =>
      JSON.stringify({ mcpServers: { finance: { url: sseUrl } } }, null, 2),
    steps: (configPath) => [
      'Open Claude Desktop → Settings → Developer → Edit Config',
      <>Paste the snippet below into <code className="font-mono text-xs bg-surface px-1 py-0.5 rounded">{String(configPath)}</code></>,
      'Save and restart Claude Desktop',
      'A browser window will open — sign in once to authorize',
    ],
  },
  {
    id: 'claude-code',
    label: 'Claude Code',
    configPath: '',
    snippet: (sseUrl) =>
      `claude mcp add finance --transport sse ${sseUrl}`,
    steps: () => [
      'Run the command below in your terminal (requires the Claude Code CLI)',
      'Claude Code will save the server to your global MCP config',
      'Finance tools will be available in all future Claude Code sessions',
    ],
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    configPath: '',
    snippet: (sseUrl) => sseUrl,
    steps: () => [
      'Go to chatgpt.com → Settings → Connectors (requires Plus or Pro)',
      'Click Create connector and paste the URL below into the endpoint field',
      'Save — the finance connector will appear in your ChatGPT sessions',
    ],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    configPath: '~/.gemini/settings.json',
    snippet: (sseUrl) =>
      JSON.stringify(
        { mcpServers: { finance: { httpUrl: sseUrl } } },
        null,
        2
      ),
    steps: (configPath) => [
      'Install the Gemini CLI: npm install -g @google/gemini-cli',
      <>Open or create <code className="font-mono text-xs bg-surface px-1 py-0.5 rounded">{String(configPath)}</code></>,
      'Paste the snippet below (merge with any existing mcpServers) and save',
      'Finance tools will be available in the next Gemini CLI session',
    ],
  },
  {
    id: 'grok',
    label: 'Grok',
    configPath: '',
    snippet: (sseUrl) => sseUrl,
    steps: () => [
      'Open grok.com and start a new conversation',
      'Click the tools / connectors icon in the chat toolbar',
      'Select Add MCP Server and paste the URL below',
      'Finance tools will be available immediately in that session',
    ],
  },
]

function DevToolsCard() {
  const mcpUrl = process.env.NEXT_PUBLIC_MCP_SERVER_URL ?? ''
  const sseUrl = mcpUrl ? `${mcpUrl}/sse` : 'https://mcp.budgitbuddy.com/sse'

  const [activeTab, setActiveTab] = useState(CLIENT_TABS[0].id)
  const [copied, setCopied] = useState(false)

  const tab = CLIENT_TABS.find((t) => t.id === activeTab) ?? CLIENT_TABS[0]
  const snippet = tab.snippet(sseUrl)
  const steps = tab.steps(tab.configPath)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API unavailable (e.g. non-HTTPS dev)
    }
  }

  return (
    <section className="app-panel rounded-3xl p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-cream">Developer Tools</h2>
        <p className="text-sm text-cream-muted mt-1">
          Connect your AI assistant to this app&apos;s MCP server to query your finances directly from chat.
        </p>
      </div>

      {/* Client tabs */}
      <div className="flex flex-wrap gap-1.5">
        {CLIENT_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setCopied(false) }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === t.id
                ? 'bg-accent text-accent-contrast'
                : 'border border-surface-border text-cream-muted hover:text-cream'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Steps */}
      <ol className="text-sm text-cream-muted space-y-1.5 list-decimal list-inside">
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>

      {/* Snippet */}
      <div className="relative">
        <pre className="bg-surface border border-surface-border rounded-xl p-4 text-xs font-mono text-cream overflow-x-auto whitespace-pre-wrap break-all">
          {snippet}
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
  const { isPro } = useSubscription()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  const [nameInput, setNameInput] = useState<string>('')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [showDevTools, setShowDevTools] = useState(false)

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
            onClick={() => {
              // Free users can connect their first account; block a second
              if (!isPro && accounts.length >= 1) {
                setShowUpgradeModal(true)
              } else {
                handleGetLinkToken()
              }
            }}
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

        {showUpgradeModal && (
          <UpgradeModal feature="unlimited bank accounts" onClose={() => setShowUpgradeModal(false)} />
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
              className="text-sm text-accent-text dark:text-accent hover:underline disabled:opacity-50"
            >
              {syncMutation.isPending ? 'Syncing…' : 'Sync now'}
            </button>
          )}
        </div>

        {syncMutation.data && (
          <div className="rounded-lg border border-accent/25 bg-accent/10 px-4 py-2 text-sm text-accent-text dark:text-accent">
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

      {/* Developer Tools — hidden by default */}
      {showDevTools && <DevToolsCard />}

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

        {/* Developer tools toggle */}
        <div
          role="button"
          onClick={() => setShowDevTools((v) => !v)}
          className="flex items-center justify-between rounded-xl border border-surface-border px-4 py-3 cursor-pointer hover:bg-surface transition-colors"
        >
          <div>
            <p className="text-sm font-medium text-cream">Developer Tools</p>
            <p className="text-xs text-cream-muted mt-0.5">MCP server connection configs for AI clients</p>
          </div>
          {/* Toggle switch */}
          <div className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors ${showDevTools ? 'bg-accent' : 'bg-surface-border'}`}>
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${showDevTools ? 'translate-x-5' : 'translate-x-1'}`} />
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
