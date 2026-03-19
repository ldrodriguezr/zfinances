import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseUrl, getSupabaseAnonKey, checkSupabaseEnv } from './env-check'

export async function createClient() {
  const { ok, missing } = checkSupabaseEnv('client')
  if (!ok) {
    console.error('[Supabase server] Missing env vars:', missing.join(', '))
    throw new Error(`Supabase: faltan variables de entorno: ${missing.join(', ')}. Revisa Vercel → Settings → Environment Variables.`)
  }

  const url = getSupabaseUrl()
  const anonKey = getSupabaseAnonKey()
  if (!url || !anonKey) {
    throw new Error('Supabase: URL o ANON_KEY vacíos tras validación.')
  }

  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          // Ignorado en Server Components
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch {}
      },
    },
    db: {
      schema: 'personal_finance',
    },
  })
}
