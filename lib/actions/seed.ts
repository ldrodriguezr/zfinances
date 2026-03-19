'use server'

import { createClient } from '@/utils/supabase/server'

const SEED_ACCOUNTS = [
  { name: 'Efectivo Principal', account_type: 'LIQUIDITY', currency: 'CRC' },
  { name: 'SINPE Móvil', account_type: 'LIQUIDITY', currency: 'CRC' },
  { name: 'TC Master BAC', account_type: 'CREDIT', currency: 'CRC' },
  { name: 'TC AMEX Scotiabank', account_type: 'CREDIT', currency: 'USD' },
] as const

const SEED_CATEGORIES = [
  'Vivienda (Renta/Hipoteca)',
  'Servicios Públicos (Agua, Luz, Internet)',
  'Supermercado (Comida casa)',
  'Restaurantes (Comida fuera)',
  'Transporte (Gasolina, Uber, Bus)',
  'Salud (Farmacia, Citas médicas)',
  'Entretenimiento (Cine, Suscripciones)',
  'Educación (Cursos, Libros)',
  'Compras (Ropa, Tecnología)',
  'Finanzas (Pago tarjetas, Intereses, Comisiones)',
] as const

/**
 * Siembra datos maestros si el usuario no tiene. Se ejecuta al entrar al Panel de Control.
 */
export async function ensureUserSeed(userId: string) {
  const supabase = await createClient()

  const { data: existingAccounts } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('user_id', userId)

  const existingNames = new Set((existingAccounts ?? []).map((a) => a.name))

  for (const acc of SEED_ACCOUNTS) {
    if (existingNames.has(acc.name)) continue
    const { error: accErr } = await supabase.from('accounts').insert({
      user_id: userId,
      name: acc.name,
      account_type: acc.account_type,
      currency: acc.currency,
      is_active: true,
    })
    if (accErr) throw accErr
    existingNames.add(acc.name)
  }

  const { data: existingCategories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', userId)
    .eq('level', 1)

  const existingCatNames = new Set((existingCategories ?? []).map((c) => c.name))

  for (const name of SEED_CATEGORIES) {
    if (existingCatNames.has(name)) continue
    const { error: catErr } = await supabase.from('categories').insert({
      user_id: userId,
      name,
      level: 1,
      parent_category_id: null,
      category_kind: 'EXPENSE',
    })
    if (catErr) throw catErr
    existingCatNames.add(name)
  }

  return { ok: true }
}
