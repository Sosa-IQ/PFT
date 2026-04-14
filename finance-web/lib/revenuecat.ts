// lib/revenuecat.ts
//
// RevenueCat is connected to Stripe via the RC Stripe integration in the
// RC dashboard. Web payments go through Stripe directly; the backend posts
// Stripe subscription IDs to RevenueCat so mobile can use the same app_user_id
// for entitlements. The RC JS SDK is not used on web.
