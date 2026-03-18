import { createClient } from '@supabase/supabase-js'

/**
 * Cliente admin (service role) para jobs serverless y cron.
 * - Requiere `SUPABASE_SERVICE_ROLE_KEY` en Vercel.
 * - El service role evita RLS para poder administrar/consultar por `user_id`.
 */
export function createAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      db: { schema: 'personal_finance' },
      auth: { persistSession: false },
    }
  )
}

