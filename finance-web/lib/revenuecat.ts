// lib/revenuecat.ts — Thin wrapper around the RevenueCat Purchases JS SDK.
//
// Set NEXT_PUBLIC_REVENUECAT_API_KEY in finance-web/.env to your RevenueCat
// web API key (starts with "rcb_"). Until that key is set, purchase() will
// throw an error — the UI handles this gracefully by prompting setup.

import { Purchases, type Package } from '@revenuecat/purchases-js'

const RC_API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY ?? ''

// Entitlement identifier created in RevenueCat dashboard
export const PRO_ENTITLEMENT = 'Pro'

// RevenueCat package identifiers (must match what you create in RC dashboard)
export const MONTHLY_PACKAGE_ID = '$rc_monthly'
export const ANNUAL_PACKAGE_ID = '$rc_annual'

let configured = false

/** Call once after the user's Supabase ID is known. Safe to call multiple times. */
export function configureRC(userId: string) {
  if (!RC_API_KEY) return
  if (configured && Purchases.isConfigured()) {
    // If user changes (e.g. sign out → sign in), update identity
    Purchases.getSharedInstance().changeUser(userId).catch(() => null)
    return
  }
  Purchases.configure({ apiKey: RC_API_KEY, appUserId: userId })
  configured = true
}

/** Fetch available offerings from RevenueCat. Returns { monthly, annual } packages. */
export async function getOfferings(): Promise<{ monthly: Package | null; annual: Package | null }> {
  if (!RC_API_KEY || !Purchases.isConfigured()) {
    return { monthly: null, annual: null }
  }
  const offerings = await Purchases.getSharedInstance().getOfferings()
  const current = offerings.current
  return {
    monthly: current?.monthly ?? null,
    annual: current?.annual ?? null,
  }
}

/** Trigger RevenueCat checkout for a given package. Resolves on success, throws on cancel/error. */
export async function purchasePackage(pkg: Package, email?: string) {
  if (!RC_API_KEY || !Purchases.isConfigured()) {
    throw new Error('RevenueCat is not configured. Add NEXT_PUBLIC_REVENUECAT_API_KEY to your .env.')
  }
  const result = await Purchases.getSharedInstance().purchase({
    rcPackage: pkg,
    customerEmail: email,
  })
  return result
}

/** Check whether the current user has an active 'pro' entitlement in RevenueCat. */
export async function checkProEntitlement(): Promise<boolean> {
  if (!RC_API_KEY || !Purchases.isConfigured()) return false
  const info = await Purchases.getSharedInstance().getCustomerInfo()
  return PRO_ENTITLEMENT in info.entitlements.active
}
