// lib/revenuecat.ts
//
// RevenueCat is connected to Stripe via the RC Stripe integration in the
// RC dashboard. Web payments go through Stripe directly — the RC JS SDK
// is not used on web. When the mobile app is built, the RC SDK will be
// used natively (iOS/Android) and will recognize web subscribers via
// the shared Stripe connection.
