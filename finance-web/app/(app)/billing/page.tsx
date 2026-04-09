'use client'

import { useEffect, useState } from 'react'
import { useSubscription } from '@/hooks/useSubscription'
import { getOfferings, purchasePackage } from '@/lib/revenuecat'
import { supabase } from '@/lib/supabase'
import type { Package } from '@revenuecat/purchases-js'
import { PurchasesError, ErrorCode } from '@revenuecat/purchases-js'

function formatDate(d: Date | null) {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function BillingPage() {
  const { tier, isPro, isTrialing, trialEndsAt, currentPeriodEnd, cancelAtPeriodEnd, periodType, loading, refresh } =
    useSubscription()

  const [billing, setBilling] = useState<'annual' | 'monthly'>('annual')
  const [offerings, setOfferings] = useState<{ monthly: Package | null; annual: Package | null }>({
    monthly: null,
    annual: null,
  })
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    getOfferings().then(setOfferings).catch(() => null)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email)
    })
  }, [])

  async function handleUpgrade() {
    const pkg = billing === 'annual' ? offerings.annual : offerings.monthly
    if (!pkg) {
      setError('Payment system is not configured yet. Check back soon.')
      return
    }
    setPurchasing(true)
    setError(null)
    try {
      await purchasePackage(pkg, userEmail)
      refresh()
    } catch (err) {
      if (!(err instanceof PurchasesError && err.errorCode === ErrorCode.UserCancelledError)) {
        setError('Purchase failed. Please try again.')
      }
    } finally {
      setPurchasing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-sm text-cream-muted">Loading…</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-cream">Billing</h1>
        <p className="text-sm text-cream-muted mt-1">Manage your BudgIt Buddy subscription.</p>
      </div>

      {/* Current plan status */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cream-muted">Current Plan</p>
            <div className="mt-1 flex items-center gap-2">
              <h2 className="text-xl font-bold text-cream capitalize">{tier}</h2>
              {isPro && isTrialing && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">Trial</span>
              )}
              {isPro && !isTrialing && periodType && (
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success capitalize">{periodType}</span>
              )}
            </div>
          </div>
          {isPro && (
            <span className="text-2xl">⭐</span>
          )}
        </div>

        {isPro && isTrialing && trialEndsAt && (
          <div className="rounded-xl bg-accent/10 px-4 py-3 text-sm">
            <p className="font-medium text-accent">Free trial active</p>
            <p className="text-cream-muted text-xs mt-0.5">
              Trial ends {formatDate(trialEndsAt)}. You won't be charged until then.
            </p>
          </div>
        )}

        {isPro && cancelAtPeriodEnd && currentPeriodEnd && (
          <div className="rounded-xl bg-warning/10 px-4 py-3 text-sm">
            <p className="font-medium text-warning-display">Cancellation scheduled</p>
            <p className="text-cream-muted text-xs mt-0.5">
              Pro access continues until {formatDate(currentPeriodEnd)}.
            </p>
          </div>
        )}

        {isPro && !cancelAtPeriodEnd && currentPeriodEnd && (
          <p className="text-xs text-cream-muted">
            Next billing date: <span className="text-cream">{formatDate(currentPeriodEnd)}</span>
          </p>
        )}

        {!isPro && (
          <p className="text-sm text-cream-muted">
            You're on the free plan. Upgrade to Pro to unlock all features.
          </p>
        )}
      </div>

      {/* Upgrade section (only shown for free users) */}
      {!isPro && (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6 space-y-5">
          <div>
            <h3 className="text-lg font-bold text-cream">Upgrade to Pro</h3>
            <p className="text-sm text-cream-muted mt-1">
              Get unlimited accounts, full history, goals tracking, and AI insights.
            </p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center gap-0 rounded-xl bg-surface p-1 ring-1 ring-surface-border">
            {(['annual', 'monthly'] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                  billing === b ? 'bg-accent text-accent-contrast' : 'text-cream-muted hover:text-cream'
                }`}
              >
                {b === 'annual' ? (
                  <span className="flex items-center justify-center gap-1.5">
                    Annual <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">Save 29%</span>
                  </span>
                ) : 'Monthly'}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-1">
            <span className="text-4xl font-bold text-cream">
              {billing === 'annual' ? '$59.99' : '$6.99'}
            </span>
            <span className="text-sm text-cream-muted mb-1">
              {billing === 'annual' ? '/year' : '/month'}
            </span>
          </div>
          {billing === 'annual' && (
            <p className="text-xs text-success font-medium -mt-3">$5.00/month · save 29%</p>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            onClick={handleUpgrade}
            disabled={purchasing}
            className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-contrast hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {purchasing ? 'Opening checkout…' : 'Start 7-day free trial'}
          </button>
          <p className="text-center text-xs text-cream-muted">
            Try Pro free for 7 days, then {billing === 'annual' ? '$59.99/year' : '$6.99/month'}. Cancel anytime.
          </p>
        </div>
      )}

      {/* Pro features list */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 space-y-3">
        <h3 className="text-sm font-semibold text-cream">What's included in Pro</h3>
        <ul className="space-y-2">
          {[
            ['Unlimited bank accounts', isPro],
            ['Full transaction history', isPro],
            ['Unlimited budgets & categories', isPro],
            ['Savings goals tracking', isPro],
            ['AI insights via Claude', isPro],
            ['Priority support', isPro],
          ].map(([label, active]) => (
            <li key={String(label)} className={`flex items-center gap-2.5 text-sm ${active ? 'text-cream' : 'text-cream-muted'}`}>
              <svg className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-cream-muted/40'}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {String(label)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
