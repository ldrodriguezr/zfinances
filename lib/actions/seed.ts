'use server'

import { createClient } from '@/utils/supabase/server'

const SEED_ACCOUNTS = [
  { name: 'Efectivo', account_type: 'LIQUIDITY', currency: 'CRC' },
  { name: 'SINPE', account_type: 'LIQUIDITY', currency: 'CRC' },
  { name: 'Transferencia', account_type: 'LIQUIDITY', currency: 'CRC' },
  { name: 'BAC TC Master', account_type: 'CREDIT', currency: 'CRC' },
  { name: 'BAC TC AMEX', account_type: 'CREDIT', currency: 'USD' },
] as const

const SEED_CATEGORIES: Array<{
  name: string
  kind: 'EXPENSE' | 'INCOME'
  children?: string[]
}> = [
  {
    name: 'Vivienda',
    kind: 'EXPENSE',
    children: ['Renta/Hipoteca', 'Mantenimiento hogar', 'Seguros hogar'],
  },
  {
    name: 'Servicios Públicos',
    kind: 'EXPENSE',
    children: ['Agua', 'Electricidad', 'Internet/Cable', 'Telefonía'],
  },
  {
    name: 'Supermercado',
    kind: 'EXPENSE',
    children: ['Comida casa', 'Limpieza', 'Productos personales'],
  },
  {
    name: 'Restaurantes',
    kind: 'EXPENSE',
    children: ['Comida fuera', 'Delivery', 'Cafetería'],
  },
  {
    name: 'Transporte',
    kind: 'EXPENSE',
    children: ['Gasolina', 'Uber/DiDi', 'Bus/Tren', 'Parqueo', 'Mantenimiento vehículo'],
  },
  {
    name: 'Salud',
    kind: 'EXPENSE',
    children: ['Farmacia', 'Citas médicas', 'Seguro médico', 'Dental/Óptica'],
  },
  {
    name: 'Entretenimiento',
    kind: 'EXPENSE',
    children: ['Cine/Teatro', 'Suscripciones', 'Viajes/Vacaciones', 'Hobbies'],
  },
  {
    name: 'Educación',
    kind: 'EXPENSE',
    children: ['Cursos', 'Libros', 'Materiales', 'Matrícula'],
  },
  {
    name: 'Compras',
    kind: 'EXPENSE',
    children: ['Ropa/Calzado', 'Tecnología', 'Electrodomésticos'],
  },
  {
    name: 'Finanzas',
    kind: 'EXPENSE',
    children: ['Pago tarjetas', 'Intereses', 'Comisiones bancarias', 'Seguros'],
  },
  {
    name: 'Impuestos',
    kind: 'EXPENSE',
    children: ['Renta', 'Marchamo', 'Municipalidad'],
  },
  {
    name: 'Mascotas',
    kind: 'EXPENSE',
    children: ['Veterinario', 'Comida mascota', 'Accesorios'],
  },
  {
    name: 'Ingresos',
    kind: 'INCOME',
    children: ['Salario', 'Freelance', 'Inversiones', 'Otros ingresos'],
  },
]

export async function ensureUserSeed(userId: string) {
  const supabase = await createClient()

  // --- Accounts ---
  const { data: existingAccounts } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('user_id', userId)

  const existingNames = new Set((existingAccounts ?? []).map((a) => a.name))
  const seedNames = new Set(SEED_ACCOUNTS.map((a) => a.name))

  // Desactivar cuentas viejas del seed anterior que ya no están en la lista
  const oldSeedNames = ['Efectivo CRC', 'BAC CRC', 'SINPE CRC', 'AMEX USD', 'Efectivo Principal', 'SINPE Móvil', 'TC Master BAC', 'TC AMEX Scotiabank', 'Efectivo/Principal']
  for (const oldName of oldSeedNames) {
    if (existingNames.has(oldName) && !seedNames.has(oldName)) {
      await supabase
        .from('accounts')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('name', oldName)
    }
  }

  for (const acc of SEED_ACCOUNTS) {
    if (existingNames.has(acc.name)) continue
    await supabase.from('accounts').insert({
      user_id: userId,
      name: acc.name,
      account_type: acc.account_type,
      currency: acc.currency,
      is_active: true,
    })
    existingNames.add(acc.name)
  }

  // --- Categories (multinivel) ---
  const { data: existingCats } = await supabase
    .from('categories')
    .select('id, name, level')
    .eq('user_id', userId)

  const existingL1Names = new Set(
    (existingCats ?? []).filter((c) => c.level === 1).map((c) => c.name)
  )

  for (const cat of SEED_CATEGORIES) {
    let parentId: string | null = null

    if (!existingL1Names.has(cat.name)) {
      const { data: inserted } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: cat.name,
          level: 1,
          parent_category_id: null,
          category_kind: cat.kind,
        })
        .select('id')
        .single()
      parentId = inserted?.id ?? null
      existingL1Names.add(cat.name)
    } else {
      const found = (existingCats ?? []).find((c) => c.name === cat.name && c.level === 1)
      parentId = found?.id ?? null
    }

    if (parentId && cat.children?.length) {
      const existingL2Names = new Set(
        (existingCats ?? [])
          .filter((c) => c.level === 2)
          .map((c) => c.name)
      )
      for (const childName of cat.children) {
        if (existingL2Names.has(childName)) continue
        await supabase.from('categories').insert({
          user_id: userId,
          name: childName,
          level: 2,
          parent_category_id: parentId,
          category_kind: cat.kind,
        })
      }
    }
  }

  return { ok: true }
}
