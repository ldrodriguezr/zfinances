'use server'

import { createClient } from '@/utils/supabase/server'
import { ensureUserSeed } from './seed'

/**
 * Ejecutar al entrar al Panel de Control. Crea user_settings y siembra cuentas/categorías si están vacías.
 */
export async function ensureUserOnboarding(userId: string) {
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('user_settings')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!settings) {
    const { error: usErr } = await supabase.from('user_settings').insert({
      user_id: userId,
      home_currency: 'CRC',
      debt_strategy: 'AVALANCHE',
    })
    if (usErr) throw usErr
  }

  await ensureUserSeed(userId)
  return { ok: true }
}
