import { createClient } from '@supabase/supabase-js'
import { getSupabaseUrl, getSupabaseServiceRoleKey } from './env-check'

/**
 * Cliente admin (service role) para jobs serverless y cron.
 * Solo se usa en el servidor (API routes, server actions).
 */
export function createAdminClient() {
  const url = getSupabaseUrl()
  const serviceKey = getSupabaseServiceRoleKey()

  if (!url) {
    const err = 'Falta NEXT_PUBLIC_SUPABASE_URL'
    console.error('[Supabase admin]', err)
    throw new Error(err)
  }
  if (!serviceKey) {
    const err = 'Falta SUPABASE_SERVICE_ROLE_KEY'
    console.error('[Supabase admin]', err)
    throw new Error(err)
  }

  return createClient(url, serviceKey, {
    db: { schema: 'personal_finance' },
    auth: { persistSession: false },
  })
}
