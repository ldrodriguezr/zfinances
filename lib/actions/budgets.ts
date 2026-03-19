'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type CreateBudgetResult = { success: true } | { success: false; error: string }

export async function createBudgetForMonth(monthStartYMD: string): Promise<CreateBudgetResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }
    const userId = user.id

    const { data: existing } = await supabase
      .from('monthly_budgets')
      .select('id')
      .eq('user_id', userId)
      .eq('month_start', monthStartYMD)
      .maybeSingle()

    if (existing) return { success: false, error: 'Ya existe presupuesto para este mes' }

    const { data: categories } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .eq('level', 1)

    if (!categories?.length) return { success: false, error: 'Crea categorías primero (Flujo de Caja usa el seed)' }

    const { data: budget, error: budgetErr } = await supabase
      .from('monthly_budgets')
      .insert({
        user_id: userId,
        month_start: monthStartYMD,
        currency: 'CRC',
        income_total_home: 0,
        available_home: 0,
        status: 'DRAFT',
      })
      .select('id')
      .single()

    if (budgetErr) return { success: false, error: budgetErr.message }

    for (const cat of categories) {
      await supabase.from('budget_lines').insert({
        budget_id: budget.id,
        user_id: userId,
        category_level1_id: cat.id,
        budget_amount_home: 0,
        spent_amount_home: 0,
        execution_pct: 0,
      })
    }

    revalidatePath('/presupuestos')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al crear presupuesto' }
  }
}
