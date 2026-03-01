'use client'

import { createContext, useContext } from 'react'

// Context holds the Supabase access_token string.
// Set by (app)/layout.tsx once the session is confirmed.
export const AuthTokenContext = createContext<string | null>(null)

// Returns the current access token. Throws if used outside the app layout
// (i.e. before authentication is confirmed).
export function useAuthToken(): string {
  const token = useContext(AuthTokenContext)
  if (!token) throw new Error('useAuthToken must be used inside an authenticated layout')
  return token
}
