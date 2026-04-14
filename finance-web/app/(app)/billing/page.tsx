'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSubscription } from '@/hooks/useSubscription'
import { useAuthToken } from '@/hooks/useAuthToken'
import {
  cancelStripeSubscription,
  reactivateStripeSubscription,
  changeStripePlan,
  previewChangePlan,
  type ChangePlanPreview,
} from '@/lib/api'

function formatDate(d: Date | null) {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

// ── Manage subscription section (Pro users only) ─────────────────────────

function ManageSubscription() {
  const token = useAuthToken()
  const { isTrialing, trialEndsAt, currentPeriodEnd, cancelAtPeriodEnd, periodType, refresh } =
    useSubscription()

  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmUpgrade, setConfirmUpgrade] = useState(false)
  const [upgradePreview, setUpgradePreview] = useState<ChangePlanPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCancel() {
    setBusy(true)
    setError(null)
    try {
      await cancelStripeSubscription(token)
      await refresh()
      setConfirmCancel(false)
    } catch {
      setError('Failed to cancel. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleReactivate() {
    setBusy(true)
    setError(null)
    try {
      await reactivateStripeSubscription(token)
      await refresh()
    } catch {
      setError('Failed to reactivate. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleInitiateUpgrade() {
    if (isTrialing) {
      // No proration during a trial — just show a simple confirmation
      setConfirmUpgrade(true)
      return
    }
    setPreviewLoading(true)
    setError(null)
    try {
      const preview = await previewChangePlan(token)
      setUpgradePreview(preview)
      setConfirmUpgrade(true)
    } catch {
      setError('Failed to load upgrade details. Please try again.')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleConfirmUpgrade() {
    setBusy(true)
    setError(null)
    try {
      await changeStripePlan(token, 'annual')
      await refresh()
      setConfirmUpgrade(false)
      setUpgradePreview(null)
    } catch {
      setError('Failed to switch plan. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 space-y-5">
      <h3 className="text-sm font-semibold text-cream">Manage subscription</h3>

      {error && (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      {/* Switch plan — only shown for active monthly subscribers */}
      {!cancelAtPeriodEnd && !isTrialing && periodType && (
        <div className="rounded-xl border border-surface-border px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-cream capitalize">{periodType} billing</p>
              <p className="text-xs text-cream-muted mt-0.5">
                {periodType === 'annual'
                  ? '$59.99/year · billed annually'
                  : '$6.99/month · billed monthly'}
              </p>
            </div>
            {periodType === 'monthly' && (
              <button
                onClick={handleInitiateUpgrade}
                disabled={busy || previewLoading}
                className="text-xs font-medium text-accent hover:text-accent-hover transition-colors disabled:opacity-50 whitespace-nowrap ml-4"
              >
                {previewLoading ? 'Loading…' : 'Switch to annual (save 29%)'}
              </button>
            )}
          </div>

          {/* Upgrade confirmation with proration details */}
          {confirmUpgrade && (
            <div className="space-y-3 pt-2 border-t border-surface-border">
              <div className="rounded-xl border border-accent/25 bg-accent/10 px-4 py-4 space-y-1.5">
                <p className="text-sm font-medium text-cream">Switch to annual billing?</p>
                {upgradePreview ? (
                  <p className="text-xs text-cream-muted">
                    Your annual upgrade total is{' '}
                    <span className="text-cream font-medium">
                      ${upgradePreview.invoice_total.toFixed(2)}{' '}
                    </span>
                    today, including a{' '}
                    <span className="text-cream font-medium">
                      ${upgradePreview.unused_monthly_credit.toFixed(2)}{' '}
                    </span>
                    credit for unused monthly time.
                    {upgradePreview.applied_balance_credit > 0 && (
                      <>
                        {' '}After applying your existing{' '}
                        <span className="text-cream font-medium">
                          ${upgradePreview.applied_balance_credit.toFixed(2)}{' '}
                        </span>
                        account credit, Stripe will charge{' '}
                        <span className="text-cream font-medium">
                          ${upgradePreview.amount_due.toFixed(2)}{' '}
                        </span>
                        today.
                      </>
                    )}
                    {' '}After that, you'll be billed{' '}
                    <span className="text-cream font-medium">$59.99/year</span>.
                  </p>
                ) : (
                  <p className="text-xs text-cream-muted">
                    You'll be billed{' '}
                    <span className="text-cream font-medium">$59.99/year</span> starting today.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmUpgrade}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-contrast hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {busy ? 'Switching…' : 'Confirm switch to annual'}
                </button>
                <button
                  onClick={() => { setConfirmUpgrade(false); setUpgradePreview(null) }}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-surface-border py-2.5 text-sm font-medium text-cream-muted hover:text-cream transition-colors disabled:opacity-50"
                >
                  Keep monthly
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trial plan info — only upgrade to annual allowed */}
      {isTrialing && periodType && (
        <div className="rounded-xl border border-surface-border px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-cream capitalize">{periodType} billing</p>
              <p className="text-xs text-cream-muted mt-0.5">
                Starts after trial ends {formatDate(trialEndsAt)}
              </p>
            </div>
            {periodType === 'monthly' && (
              <button
                onClick={handleInitiateUpgrade}
                disabled={busy}
                className="text-xs font-medium text-accent hover:text-accent-hover transition-colors disabled:opacity-50 whitespace-nowrap ml-4"
              >
                Switch to annual (save 29%)
              </button>
            )}
          </div>

          {/* Trial upgrade confirmation — no proration, just plan change at trial end */}
          {confirmUpgrade && (
            <div className="space-y-3 pt-2 border-t border-surface-border">
              <div className="rounded-xl border border-accent/25 bg-accent/10 px-4 py-4 space-y-1.5">
                <p className="text-sm font-medium text-cream">Switch to annual billing?</p>
                <p className="text-xs text-cream-muted">
                  You won't be charged now. When your trial ends on{' '}
                  <span className="text-cream">{formatDate(trialEndsAt)}</span>, you'll be billed{' '}
                  <span className="text-cream font-medium">$59.99/year</span> instead of
                  $6.99/month — saving $23.89 per year.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmUpgrade}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-contrast hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {busy ? 'Switching…' : 'Confirm switch to annual'}
                </button>
                <button
                  onClick={() => setConfirmUpgrade(false)}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-surface-border py-2.5 text-sm font-medium text-cream-muted hover:text-cream transition-colors disabled:opacity-50"
                >
                  Keep monthly
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cancel / reactivate */}
      {cancelAtPeriodEnd ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-warning/10 border border-warning/20 px-4 py-3 text-sm">
            <p className="font-medium text-warning-display">Cancellation scheduled</p>
            <p className="text-cream-muted text-xs mt-0.5">
              Your Pro access continues until {formatDate(currentPeriodEnd ?? trialEndsAt)}.
            </p>
          </div>
          <button
            onClick={handleReactivate}
            disabled={busy}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-contrast hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {busy ? 'Reactivating…' : 'Keep Pro subscription'}
          </button>
        </div>
      ) : confirmCancel ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-4 space-y-1">
            <p className="text-sm font-medium text-danger">Cancel subscription?</p>
            <p className="text-xs text-cream-muted">
              You'll keep Pro access until{' '}
              <span className="text-cream">{formatDate(currentPeriodEnd ?? trialEndsAt ?? null)}</span>.
              After that, your account reverts to the free plan.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={busy}
              className="flex-1 rounded-xl bg-danger py-2.5 text-sm font-semibold text-white hover:bg-danger/80 transition-colors disabled:opacity-50"
            >
              {busy ? 'Cancelling…' : 'Yes, cancel'}
            </button>
            <button
              onClick={() => setConfirmCancel(false)}
              disabled={busy}
              className="flex-1 rounded-xl border border-surface-border py-2.5 text-sm font-medium text-cream-muted hover:text-cream transition-colors disabled:opacity-50"
            >
              Keep Pro
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmCancel(true)}
          disabled={busy}
          className="w-full rounded-xl border border-surface-border py-2.5 text-sm font-medium text-cream-muted hover:text-danger hover:border-danger/30 transition-colors disabled:opacity-50"
        >
          Cancel subscription
        </button>
      )}
    </div>
  )
}

// ── Main billing page ─────────────────────────────────────────────────────

export default function BillingPage() {
  const router = useRouter()
  const { tier, isPro, isTrialing, trialEndsAt, currentPeriodEnd, cancelAtPeriodEnd, periodType, trialEligible, loading } =
    useSubscription()

  const [billing, setBilling] = useState<'annual' | 'monthly'>('annual')

  function handleUpgrade() {
    router.push(`/checkout?plan=${billing}`)
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
          {isPro && <span className="text-2xl">⭐</span>}
        </div>

        {isPro && isTrialing && trialEndsAt && (
          <div className="rounded-xl bg-accent/10 px-4 py-3 text-sm">
            <p className="font-medium text-accent">Free trial active</p>
            <p className="text-cream-muted text-xs mt-0.5">
              Trial ends {formatDate(trialEndsAt)}. You won't be charged until then.
            </p>
          </div>
        )}

        {isPro && !cancelAtPeriodEnd && currentPeriodEnd && !isTrialing && (
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

      {/* Subscription management actions (Pro users) */}
      {isPro && <ManageSubscription />}

      {/* Upgrade section (free users only) */}
      {!isPro && (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6 space-y-5">
          <div>
            <h3 className="text-lg font-bold text-cream">Upgrade to Pro</h3>
            <p className="text-sm text-cream-muted mt-1">
              Get unlimited accounts, full history, goals tracking, and AI insights.
            </p>
          </div>

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

          <button
            onClick={handleUpgrade}
            className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-contrast hover:bg-accent-hover transition-colors"
          >
            {trialEligible ? 'Start 7-day free trial' : `Subscribe for ${billing === 'annual' ? '$59.99/year' : '$6.99/month'}`}
          </button>
          <p className="text-center text-xs text-cream-muted">
            {trialEligible
              ? `Try Pro free for 7 days, then ${billing === 'annual' ? '$59.99/year' : '$6.99/month'}. Cancel anytime.`
              : 'You will be charged today. Cancel anytime.'}
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
