'use client'

// hooks/useSubscription.tsx — Subscription context for the app.
//
// Wraps the (app) layout so any page can call useSubscription() to check
// the current user's tier without prop drilling.

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSubscription, type SubscriptionInfo } from '@/lib/api'
import { configureRC, checkProEntitlement } from '@/lib/revenuecat'

interface SubscriptionState {
  tier: 'free' | 'pro'
  isPro: boolean
  isTrialing: boolean
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  periodType: 'monthly' | 'annual' | null
  loading: boolean
  /** Re-fetch after a purchase completes */
  refresh: () => void
}

const defaultState: SubscriptionState = {
  tier: 'free',
  isPro: false,
  isTrialing: false,
  trialEndsAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  periodType: null,
  loading: true,
  refresh: () => {},
}

const SubscriptionContext = createContext<SubscriptionState>(defaultState)

export function SubscriptionProvider({
  session,
  children,
}: {
  session: Session
  children: React.ReactNode
}) {
  const [state, setState] = useState<Omit<SubscriptionState, 'refresh'>>(defaultState)

  const fetchSubscription = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    try {
      // Check both our backend DB and RevenueCat directly.
      // RC is the source of truth — webhooks may lag (especially in local dev),
      // so if RC says pro we honour that even if the DB hasn't caught up yet.
      const [data, rcIsPro] = await Promise.all([
        getSubscription(session.access_token),
        checkProEntitlement(),
      ])

      const effectiveTier: 'free' | 'pro' = (data.tier === 'pro' || rcIsPro) ? 'pro' : 'free'
      const now = new Date()
      const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null
      const isTrialing = !!trialEndsAt && trialEndsAt > now && effectiveTier === 'pro'

      setState({
        tier: effectiveTier,
        isPro: effectiveTier === 'pro',
        isTrialing,
        trialEndsAt,
        currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : null,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        periodType: data.period_type,
        loading: false,
      })
    } catch {
      // Fall back to free on error — don't break the app
      setState((s) => ({ ...s, tier: 'free', isPro: false, loading: false }))
    }
  }, [session.access_token])

  useEffect(() => {
    // Initialize RevenueCat with the user's Supabase UUID
    configureRC(session.user.id)
    fetchSubscription()
  }, [session.user.id, fetchSubscription])

  return (
    <SubscriptionContext.Provider value={{ ...state, refresh: fetchSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  return useContext(SubscriptionContext)
}
