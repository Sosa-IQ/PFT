'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { supabase } from '@/lib/supabase'
import { createStripeSubscription, activateStripeSubscription } from '@/lib/api'
import { useAuthToken } from '@/hooks/useAuthToken'
import { useSubscription } from '@/hooks/useSubscription'
import { useTheme } from '@/components/ThemeProvider'

const STRIPE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null

const FEATURES = [
  'Unlimited bank accounts',
  'Full transaction history',
  'Unlimited budgets & categories',
  'Savings goals tracking',
  'AI insights via Claude',
  'Priority support',
]

// ── Card form (must live inside <Elements>) ───────────────────────────────

function CardForm({
  plan,
  hasTrial,
  onSuccess,
}: {
  plan: 'monthly' | 'annual'
  hasTrial: boolean
  onSuccess: (activate: boolean) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)

    // For no-trial, append activate=1 so the redirect-return handler knows to
    // call /stripe/activate-subscription before redirecting to the dashboard.
    const returnUrl = `${window.location.origin}/checkout?plan=${plan}&redirect_status=succeeded${!hasTrial ? '&activate=1' : ''}`

    // Both trial and no-trial use confirmSetup — the no-trial path collects the
    // card via a SetupIntent; the actual subscription is created separately.
    const { error: stripeError } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Something went wrong. Please try again.')
      setSubmitting(false)
    } else {
      onSuccess(!hasTrial)
    }
  }

  const price = plan === 'annual' ? '$59.99/year' : '$6.99/month'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement
        options={{
          layout: 'tabs',
          fields: { billingDetails: { name: 'auto' } },
        }}
      />
      {error && (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      )}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-contrast hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {submitting ? 'Processing…' : hasTrial ? 'Start 7-day free trial' : `Subscribe for ${price}`}
      </button>
      <p className="text-center text-xs text-cream-muted">
        {hasTrial
          ? 'No charge today. Your trial starts now and you can cancel anytime.'
          : 'You will be charged today. Cancel anytime.'}
      </p>
    </form>
  )
}

// ── Inner page (needs useSearchParams, wrapped in Suspense below) ─────────

function CheckoutInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const plan = (searchParams.get('plan') ?? 'annual') as 'monthly' | 'annual'
  const redirectStatus = searchParams.get('redirect_status')

  const token = useAuthToken()
  const { refresh } = useSubscription()
  const { theme } = useTheme()

  const needsActivation = searchParams.get('activate') === '1'

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [hasTrial, setHasTrial] = useState(true)
  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Called after card is confirmed (inline or via 3DS redirect).
  // For no-trial, creates the actual subscription before redirecting.
  const handleSuccess = useCallback(async (activate: boolean) => {
    if (activate) {
      try {
        await activateStripeSubscription(token, plan)
      } catch {
        setErrorMsg('Could not activate subscription. Please contact support.')
        setStatus('error')
        return
      }
    }
    refresh()
    const { data: { user } } = await supabase.auth.getUser()
    if (user && !user.user_metadata?.onboarding_completed) {
      await supabase.auth.updateUser({ data: { onboarding_completed: true } })
    }
    setStatus('success')
    router.replace('/dashboard')
  }, [token, plan, refresh, router])

  // Handle return from 3DS redirect
  useEffect(() => {
    if (redirectStatus === 'succeeded') {
      handleSuccess(needsActivation)
    } else if (redirectStatus === 'failed') {
      setErrorMsg('Payment setup failed. Please try again.')
      setStatus('error')
    }
  }, [redirectStatus, handleSuccess, needsActivation])

  // Fetch client_secret on mount (skip if we're handling a redirect return)
  useEffect(() => {
    if (redirectStatus) return
    if (!STRIPE_KEY) {
      setErrorMsg('Stripe is not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your .env and restart the dev server.')
      setStatus('error')
      return
    }

    let cancelled = false

    createStripeSubscription(token, plan)
      .then(({ client_secret, has_trial }) => {
        if (cancelled) return
        setClientSecret(client_secret)
        setHasTrial(has_trial)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        // User already has an active subscription — send them to the dashboard
        if (err instanceof Error && err.message.includes('already_subscribed')) {
          router.replace('/dashboard')
          return
        }
        setErrorMsg(err instanceof Error ? err.message : 'Could not initialize checkout.')
        setStatus('error')
      })

    // Cleanup prevents React Strict Mode's second effect run from overwriting state
    return () => { cancelled = true }
  }, [token, plan, redirectStatus, router])

  const price = plan === 'annual' ? '$59.99/year' : '$6.99/month'
  const priceCopy = hasTrial
    ? plan === 'annual'
      ? 'Try free for 7 days, then $59.99/year ($5.00/mo). Cancel anytime.'
      : 'Try free for 7 days, then $6.99/month. Cancel anytime.'
    : 'Billed today. Cancel anytime.'

  // Stripe Elements appearance — follows the app's dark/light theme
  const stripeAppearance = {
    theme: (theme === 'dark' ? 'night' : 'stripe') as 'night' | 'stripe',
    variables: {
      borderRadius: '12px',
      fontFamily: 'inherit',
    },
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">

      {/* ── Left panel — product summary ─────────────────────────────── */}
      <div className="flex flex-col justify-between gap-10 bg-surface-sidebar border-b lg:border-b-0 lg:border-r border-surface-border px-8 py-10 lg:w-[420px] lg:min-h-screen lg:sticky lg:top-0">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-surface-raised ring-1 ring-surface-border">
              <Image src="/BudgitBuddy.png" alt="BudgIt Buddy" fill sizes="40px" className="object-contain p-1" />
            </div>
            <p className="text-lg font-bold">
              <span className="text-accent">BudgIt</span>{' '}
              <span className="text-warning-display">Buddy</span>
            </p>
          </div>

          {/* Plan info */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cream-muted mb-2">
              You&apos;re subscribing to
            </p>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">Pro</span>
              <span className="text-xs text-cream-muted capitalize">{plan} billing</span>
            </div>
            <p className="text-3xl font-bold text-cream">{price}</p>
            <p className="mt-1 text-xs text-cream-muted">{priceCopy}</p>
          </div>

          {/* Features */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cream-muted mb-3">
              What&apos;s included
            </p>
            <ul className="space-y-2.5">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-cream">
                  <svg className="w-4 h-4 shrink-0 text-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center gap-2 text-xs text-cream-muted">
          <svg className="w-4 h-4 shrink-0 text-cream-muted/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Secured by Stripe · SSL encrypted · Cancel anytime
        </div>
      </div>

      {/* ── Right panel — Stripe Elements card form ───────────────────── */}
      <div className="relative flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-md space-y-6">

            {status === 'loading' && (
              <div className="flex items-center justify-center gap-3 text-sm text-cream-muted py-12">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                Loading payment form…
              </div>
            )}

            {status === 'error' && (
              <div className="rounded-2xl border border-danger/25 bg-danger/10 px-5 py-5 space-y-3">
                <p className="text-sm text-danger">{errorMsg}</p>
                <button
                  onClick={() => router.back()}
                  className="text-xs text-cream-muted underline underline-offset-2 hover:no-underline"
                >
                  Go back
                </button>
              </div>
            )}

            {status === 'ready' && clientSecret && (
              <>
                <div>
                  <h2 className="text-xl font-bold text-cream">Payment details</h2>
                  <p className="text-sm text-cream-muted mt-1">
                    {hasTrial
                      ? "Your card won't be charged until your 7-day trial ends."
                      : 'Your card will be charged today.'}
                  </p>
                </div>
                <Elements
                  stripe={stripePromise}
                  options={{ clientSecret, appearance: stripeAppearance }}
                >
                  <CardForm plan={plan} hasTrial={hasTrial} onSuccess={handleSuccess} />
                </Elements>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-surface-border px-8 py-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-cream-muted hover:text-cream transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page export (Suspense required for useSearchParams) ───────────────────

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutInner />
    </Suspense>
  )
}
