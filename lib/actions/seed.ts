'use server'

import { createClient } from '@/utils/supabase/server'

const DEFAULT_CATEGORIES = [
  'Servicios Públicos',
  'Alimentación',
  'Transporte',
  'Entretenimiento',
  'Salud',
] as const

/**
 * Siembra datos maestros si el usuario no tiene. Se ejecuta al entrar al Panel.
 */
export async function ensureUserSeed(userId: string) {
  const supabase = await createClient()

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

  const { data: categories } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('level', 1)

  if (!categories?.length) {
    for (const name of DEFAULT_CATEGORIES) {
      const { error: catErr } = await supabase.from('categories').insert({
        user_id: userId,
        name,
        level: 1,
        parent_category_id: null,
        category_kind: 'EXPENSE',
      })
      if (catErr) throw catErr
    }
  }

  return { ok: true }
}
