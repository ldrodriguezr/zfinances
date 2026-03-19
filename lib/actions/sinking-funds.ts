'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

export async function createSinkingFund(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const name = (formData.get('name') as string)?.trim()
    const annualTarget = Math.abs(parseFloat((formData.get('annual_target_home') as string) ?? '0'))
    const monthlyContribution = Math.abs(parseFloat((formData.get('contribution_monthly_home') as string) ?? '0'))
    const targetMonth = parseInt((formData.get('target_month') as string) ?? '12')

    if (!name) return { success: false, error: 'Nombre requerido' }

    const { error } = await supabase.from('sinking_funds').insert({
      user_id: user.id, name, annual_target_home: annualTarget,
      contribution_monthly_home: monthlyContribution, target_month: targetMonth, is_active: true,
    })

    if (error) return { success: false, error: error.message }
    revalidatePath('/presupuestos')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al crear fondo' }
  }
}

export async function updateSinkingFund(params: {
  id: string
  name?: string
  annualTargetHome?: number
  contributionMonthlyHome?: number
  targetMonth?: number
}): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const update: Record<string, any> = {}
    if (params.name !== undefined) update.name = params.name
    if (params.annualTargetHome !== undefined) update.annual_target_home = params.annualTargetHome
    if (params.contributionMonthlyHome !== undefined) update.contribution_monthly_home = params.contributionMonthlyHome
    if (params.targetMonth !== undefined) update.target_month = params.targetMonth

    const { error } = await supabase.from('sinking_funds').update(update).eq('id', params.id).eq('user_id', user.id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/presupuestos')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al actualizar fondo' }
  }
}

export async function deleteSinkingFund(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const { error } = await supabase.from('sinking_funds').update({ is_active: false }).eq('id', id).eq('user_id', user.id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/presupuestos')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al eliminar fondo' }
  }
}
