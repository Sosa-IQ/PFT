import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lazy singleton — only created on first use (runs in the browser).
// Avoids "supabaseUrl is required" errors during Next.js build-time pre-rendering
// when NEXT_PUBLIC_ env vars aren't set yet.
let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return _client
}

// Type-safe Proxy that forwards every property access to the real client.
// All existing imports of `supabase` (e.g. `supabase.auth.getSession()`,
// `supabase.from('accounts')`) continue to work without any changes.
export const supabase = new Proxy<SupabaseClient>({} as SupabaseClient, {
  get(_, prop, receiver) {
    const client = getClient()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
