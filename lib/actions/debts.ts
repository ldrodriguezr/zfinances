'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type CreateDebtResult = { success: true } | { success: false; error: string }

export async function createDebt(formData: FormData): Promise<CreateDebtResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const name = (formData.get('name') as string)?.trim()
    const debtType = (formData.get('debt_type') as 'REVOLVING' | 'INSTALLMENT') ?? 'INSTALLMENT'
    const currency = (formData.get('currency') as string) ?? 'CRC'
    const balance = Math.abs(parseFloat((formData.get('current_balance_home') as string) ?? '0'))
    const apr = parseFloat((formData.get('apr_annual') as string) ?? '0') || null
    const minPayment = parseFloat((formData.get('min_payment_home') as string) ?? '0') || null

    if (!name) return { success: false, error: 'Nombre requerido' }

    const { error } = await supabase.from('debts').insert({
      user_id: user.id,
      name,
      debt_type: debtType,
      currency,
      current_balance_home: balance,
      apr_annual: apr,
      min_payment_home: minPayment,
      is_active: true,
    })

    if (error) return { success: false, error: error.message }
    revalidatePath('/deudas')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al crear deuda' }
  }
}
