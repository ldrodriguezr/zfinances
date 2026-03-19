'use server'

import { createClient } from '@/utils/supabase/server'
import { ensureUserSeed } from './seed'

/**
 * Ejecutar al entrar al Dashboard. Crea user_settings, cuenta "Efectivo/Principal" y categorías si no existen.
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

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('account_type', 'LIQUIDITY')

  if (!accounts?.length) {
    const { error: accErr } = await supabase.from('accounts').insert({
      user_id: userId,
      name: 'Efectivo/Principal',
      account_type: 'LIQUIDITY',
      currency: 'CRC',
      is_active: true,
    })
    if (accErr) throw accErr
  }

  await ensureUserSeed(userId)
  return { ok: true }
}
