'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

export async function createDebt(formData: FormData): Promise<ActionResult> {
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
      user_id: user.id, name, debt_type: debtType, currency,
      current_balance_home: balance, apr_annual: apr, min_payment_home: minPayment, is_active: true,
    })

    if (error) return { success: false, error: error.message }
    revalidatePath('/deudas')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al crear deuda' }
  }
}

export async function updateDebt(params: {
  id: string
  name?: string
  currentBalanceHome?: number
  aprAnnual?: number | null
  minPaymentHome?: number | null
}): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const update: Record<string, any> = {}
    if (params.name !== undefined) update.name = params.name
    if (params.currentBalanceHome !== undefined) update.current_balance_home = params.currentBalanceHome
    if (params.aprAnnual !== undefined) update.apr_annual = params.aprAnnual
    if (params.minPaymentHome !== undefined) update.min_payment_home = params.minPaymentHome

    const { error } = await supabase.from('debts').update(update).eq('id', params.id).eq('user_id', user.id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/deudas')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al actualizar deuda' }
  }
}

export async function deleteDebt(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const { error } = await supabase.from('debts').update({ is_active: false }).eq('id', id).eq('user_id', user.id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/deudas')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al eliminar deuda' }
  }
}

export async function registerDebtPayment(params: {
  debtId: string
  amount: number
}): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const { data: debt } = await supabase
      .from('debts')
      .select('current_balance_home, name')
      .eq('id', params.debtId)
      .eq('user_id', user.id)
      .single()

    if (!debt) return { success: false, error: 'Deuda no encontrada' }

    const newBalance = Math.max(0, Number(debt.current_balance_home) - params.amount)
    const { error } = await supabase
      .from('debts')
      .update({ current_balance_home: newBalance })
      .eq('id', params.debtId)
      .eq('user_id', user.id)

    if (error) return { success: false, error: error.message }
    revalidatePath('/deudas')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al registrar pago' }
  }
}
