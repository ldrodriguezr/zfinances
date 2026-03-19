import { createBrowserClient } from '@supabase/ssr'

/**
 * Cliente para componentes del navegador.
 * Solo usa NEXT_PUBLIC_* (incluidos en el bundle en build).
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.error('[Supabase client] Missing: NEXT_PUBLIC_SUPABASE_URL=', !!url, 'NEXT_PUBLIC_SUPABASE_ANON_KEY=', !!anonKey)
  }

  return createBrowserClient(url || '', anonKey || '', {
    db: {
      schema: 'personal_finance',
    },
  })
}
