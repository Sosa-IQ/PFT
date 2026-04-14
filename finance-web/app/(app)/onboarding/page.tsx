'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { usePlaidLink } from 'react-plaid-link'
import { supabase } from '@/lib/supabase'
import { getLinkToken, exchangePlaidToken } from '@/lib/api'
import { useAuthToken } from '@/hooks/useAuthToken'
import { useSubscription } from '@/hooks/useSubscription'

// ── Types ─────────────────────────────────────────────────────────────────────

type Goal = 'spending' | 'debt' | 'savings' | 'all'

// ── Plaid Link (same pattern as settings page) ────────────────────────────────

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
    onSuccess: (public_token) => onSuccess(public_token),
    onExit: (err) => onExit(err?.error_message ?? null),
  })

  useEffect(() => {
    if (ready) open()
  }, [ready, open])

  return null
}

// ── Step 1: Goal Selection ────────────────────────────────────────────────────

const GOALS: { id: Goal; label: string; emoji: string }[] = [
  { id: 'spending', label: 'Track my spending', emoji: '📊' },
  { id: 'debt', label: 'Pay off debt', emoji: '💳' },
  { id: 'savings', label: 'Build savings', emoji: '🏦' },
  { id: 'all', label: 'All of the above', emoji: '🚀' },
]

function StepGoal({ name, onNext }: { name: string; onNext: (goal: Goal) => void }) {
  const [selected, setSelected] = useState<Goal | null>(null)

  return (
    <div className="w-full max-w-lg space-y-8">
      <div>
        <p className="text-sm font-medium text-accent mb-1">Step 1 of 3</p>
        <h1 className="text-2xl font-bold text-cream">
          Welcome{name ? `, ${name.split(' ')[0]}` : ''}!
        </h1>
        <p className="mt-2 text-cream-muted">What's your main financial goal?</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {GOALS.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelected(g.id)}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-all ${
              selected === g.id
                ? 'border-accent bg-accent/10 ring-1 ring-accent'
                : 'border-surface-border bg-surface-raised hover:border-accent/50'
            }`}
          >
            <span className="text-2xl">{g.emoji}</span>
            <span className="text-sm font-medium text-cream">{g.label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => selected && onNext(selected)}
        disabled={!selected}
        className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  )
}

// ── Step 2: Connect Bank ──────────────────────────────────────────────────────

function StepBank({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const token = useAuthToken()
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [fetchingToken, setFetchingToken] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  async function handleConnect() {
    if (!token) return
    setFetchingToken(true)
    setError(null)
    try {
      const { link_token } = await getLinkToken(token)
      setLinkToken(link_token)
    } catch {
      setError('Failed to start bank connection. You can skip and connect later in Settings.')
      setFetchingToken(false)
    }
  }

  async function handlePlaidSuccess(publicToken: string) {
    if (!token) return
    setConnecting(true)
    setLinkToken(null)
    setFetchingToken(false)
    try {
      await exchangePlaidToken(token, publicToken)
      setConnected(true)
    } catch {
      setError('Connected, but syncing failed. You can retry in Settings.')
    } finally {
      setConnecting(false)
    }
  }

  function handlePlaidExit(errorMessage: string | null) {
    setLinkToken(null)
    setFetchingToken(false)
    if (errorMessage) setError(errorMessage)
  }

  return (
    <div className="w-full max-w-lg space-y-8">
      {linkToken && (
        <PlaidLinkButton
          token={linkToken}
          onSuccess={handlePlaidSuccess}
          onExit={handlePlaidExit}
        />
      )}

      <div>
        <p className="text-sm font-medium text-accent mb-1">Step 2 of 3</p>
        <h1 className="text-2xl font-bold text-cream">Connect your bank</h1>
        <p className="mt-2 text-cream-muted">
          Link your bank account to see real spending data and insights. You can always do this later.
        </p>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-xl">🔒</span>
          <div>
            <p className="text-sm font-semibold text-cream">Bank-grade security</p>
            <p className="text-xs text-cream-muted">Powered by Plaid. Read-only access — we never store credentials.</p>
          </div>
        </div>

        {connected ? (
          <div className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Bank account connected successfully!
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={fetchingToken || connecting}
            className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {fetchingToken || connecting ? 'Connecting…' : 'Connect bank account'}
          </button>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={onNext}
          disabled={!connected}
          className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          Continue
        </button>
        <button
          onClick={onSkip}
          className="w-full rounded-xl py-2.5 text-sm text-cream-muted hover:text-cream transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Choose Plan ───────────────────────────────────────────────────────

function StepPlan({ onComplete }: { onComplete: () => void }) {
  const router = useRouter()
  const { trialEligible } = useSubscription()
  const [billing, setBilling] = useState<'annual' | 'monthly'>('annual')

  function handleProCTA() {
    router.push(`/checkout?plan=${billing}`)
  }

  const monthlyPrice = '$6.99'
  const annualPrice = '$59.99'
  const annualMonthly = '$5.00'

  return (
    <div className="w-full max-w-lg space-y-8">
      <div>
        <p className="text-sm font-medium text-accent mb-1">Step 3 of 3</p>
        <h1 className="text-2xl font-bold text-cream">Choose your plan</h1>
        <p className="mt-2 text-cream-muted">
          {trialEligible ? 'Start free or unlock everything with a 7-day trial.' : 'Start free or subscribe to unlock everything.'}
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-0 rounded-xl bg-surface-raised p-1 ring-1 ring-surface-border">
        {(['annual', 'monthly'] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBilling(b)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              billing === b
                ? 'bg-accent text-accent-contrast shadow-sm'
                : 'text-cream-muted hover:text-cream'
            }`}
          >
            {b === 'annual' ? (
              <span className="flex items-center justify-center gap-1.5">
                Annual <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">Save 29%</span>
              </span>
            ) : (
              'Monthly'
            )}
          </button>
        ))}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Free */}
        <div className="flex flex-col rounded-2xl border border-surface-border bg-surface-raised p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cream-muted">Free</p>
            <p className="mt-1 text-3xl font-bold text-cream">$0</p>
            <p className="text-xs text-cream-muted">forever</p>
          </div>
          <ul className="space-y-2 text-sm text-cream-muted flex-1">
            {['1 connected bank account', '30-day transaction history', 'Up to 5 budget categories', 'Net worth tracking', 'Manual liability entry'].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <svg className="mt-0.5 w-3.5 h-3.5 shrink-0 text-cream-muted/60" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={onComplete}
            className="w-full rounded-xl border border-surface-border py-2.5 text-sm font-medium text-cream-muted hover:text-cream hover:border-cream/30 transition-colors"
          >
            Continue with Free
          </button>
        </div>

        {/* Pro */}
        <div className="flex flex-col rounded-2xl border-2 border-accent bg-accent/5 p-5 space-y-4 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-accent-contrast">Most Popular</span>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Pro</p>
            {billing === 'annual' ? (
              <>
                <p className="mt-1 text-3xl font-bold text-cream">{annualPrice}<span className="text-base font-normal text-cream-muted">/yr</span></p>
                <p className="text-xs text-cream-muted">{annualMonthly}/month · billed annually</p>
              </>
            ) : (
              <>
                <p className="mt-1 text-3xl font-bold text-cream">{monthlyPrice}<span className="text-base font-normal text-cream-muted">/mo</span></p>
                <p className="text-xs text-cream-muted">billed monthly</p>
              </>
            )}
          </div>
          <ul className="space-y-2 text-sm text-cream flex-1">
            {['Everything in Free', 'Unlimited bank accounts', 'Full transaction history', 'Unlimited budgets & categories', 'Savings goals tracking', 'AI insights via Claude'].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <svg className="mt-0.5 w-3.5 h-3.5 shrink-0 text-accent" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={handleProCTA}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-contrast hover:bg-accent-hover transition-colors"
          >
            {trialEligible ? 'Start 7-day free trial' : `Subscribe for ${billing === 'annual' ? `${annualPrice}/yr` : `${monthlyPrice}/mo`}`}
          </button>
          <p className="text-center text-[11px] text-cream-muted">
            {trialEligible
              ? `Try Pro free for 7 days, then ${billing === 'annual' ? `${annualPrice}/yr` : `${monthlyPrice}/mo`}. Cancel anytime.`
              : 'You will be charged today. Cancel anytime.'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main Onboarding Page ──────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserName((user.user_metadata?.full_name as string) ?? '')
        setUserEmail(user.email ?? '')
      }
    })
  }, [])

  async function handleGoalNext(goal: Goal) {
    // Persist goal to user metadata (best-effort — don't block progress)
    supabase.auth.updateUser({ data: { financial_goal: goal } }).catch(() => null)
    setStep(2)
  }

  async function completeOnboarding() {
    await supabase.auth.updateUser({ data: { onboarding_completed: true } })
    router.replace('/dashboard')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-10 flex items-center gap-3">
        <div className="relative h-12 w-12 overflow-hidden rounded-2xl bg-surface-raised ring-1 ring-surface-border">
          <Image src="/BudgitBuddy.png" alt="BudgIt Buddy" fill sizes="48px" className="object-contain p-1.5" />
        </div>
        <p className="text-xl font-bold tracking-tight">
          <span className="text-accent">BudgIt</span> <span className="text-warning-display">Buddy</span>
        </p>
      </div>

      {/* Step progress dots */}
      <div className="mb-8 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-2 rounded-full transition-all ${
              s === step ? 'w-6 bg-accent' : s < step ? 'w-2 bg-accent/50' : 'w-2 bg-surface-border'
            }`}
          />
        ))}
      </div>

      {step === 1 && <StepGoal name={userName} onNext={handleGoalNext} />}
      {step === 2 && <StepBank onNext={() => setStep(3)} onSkip={() => setStep(3)} />}
      {step === 3 && <StepPlan onComplete={completeOnboarding} />}
    </div>
  )
}
