'use client'

// UpgradeModal — shown when a free user tries to access a Pro feature.
// Usage: <UpgradeModal feature="savings goals" onClose={() => setShowModal(false)} />

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSubscription } from '@/hooks/useSubscription'

interface UpgradeModalProps {
  feature: string
  onClose: () => void
}

export default function UpgradeModal({ feature, onClose }: UpgradeModalProps) {
  const router = useRouter()
  const { trialEligible } = useSubscription()
  const [billing, setBilling] = useState<'annual' | 'monthly'>('annual')

  function handleUpgrade() {
    router.push(`/checkout?plan=${billing}`)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-surface-border bg-surface-raised p-7 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">Pro Feature</p>
            <h2 className="text-xl font-bold text-cream capitalize">{feature}</h2>
            <p className="mt-1 text-sm text-cream-muted">
              Unlock {feature} and everything else Pro has to offer.
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-cream-muted hover:text-cream hover:bg-surface-hover transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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

        {/* Pricing */}
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <div className="flex items-end gap-1 mb-1">
            <span className="text-3xl font-bold text-cream">
              {billing === 'annual' ? '$59.99' : '$6.99'}
            </span>
            <span className="text-sm text-cream-muted mb-1">
              {billing === 'annual' ? '/year' : '/month'}
            </span>
          </div>
          {billing === 'annual' && (
            <p className="text-xs text-success font-medium">$5.00/mo · save 29%</p>
          )}
          <ul className="mt-3 space-y-1.5 text-xs text-cream-muted">
            {['Unlimited bank accounts', 'Full transaction history', 'Unlimited budgets & categories', 'Savings goals tracking', 'AI insights via Claude'].map((f) => (
              <li key={f} className="flex items-center gap-1.5">
                <svg className="w-3 h-3 shrink-0 text-accent" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <button
            onClick={handleUpgrade}
            className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-contrast hover:bg-accent-hover transition-colors"
          >
            {trialEligible ? 'Start 7-day free trial' : `Subscribe for ${billing === 'annual' ? '$59.99/year' : '$6.99/month'}`}
          </button>
          <p className="text-center text-[11px] text-cream-muted">
            {trialEligible ? 'Try Pro free for 7 days. Cancel anytime.' : 'You will be charged today. Cancel anytime.'}
          </p>
          <button
            onClick={onClose}
            className="w-full rounded-xl py-2 text-sm text-cream-muted hover:text-cream transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
