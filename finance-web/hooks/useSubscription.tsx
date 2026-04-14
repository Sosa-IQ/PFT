'use client'

// hooks/useSubscription.tsx — Subscription context for the app.
//
// Wraps the (app) layout so any page can call useSubscription() to check
// the current user's tier without prop drilling.

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSubscription, type SubscriptionInfo } from '@/lib/api'

interface SubscriptionState {
  tier: 'free' | 'pro'
  isPro: boolean
  isTrialing: boolean
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  periodType: 'monthly' | 'annual' | null
  trialEligible: boolean
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
  trialEligible: true,
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
      const data = await getSubscription(session.access_token)
      const now = new Date()
      const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null
      const isTrialing = !!trialEndsAt && trialEndsAt > now && data.tier === 'pro'

      setState({
        tier: data.tier,
        isPro: data.tier === 'pro',
        isTrialing,
        trialEndsAt,
        currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : null,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        periodType: data.period_type,
        trialEligible: data.trial_eligible,
        loading: false,
      })
    } catch {
      // Fall back to free on error — don't break the app
      setState((s) => ({ ...s, tier: 'free', isPro: false, loading: false }))
    }
  }, [session.access_token])

  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  return (
    <SubscriptionContext.Provider value={{ ...state, refresh: fetchSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  return useContext(SubscriptionContext)
}
