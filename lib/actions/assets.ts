'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionResult = { success: true } | { success: false; error: string }

export async function createAsset(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const name = (formData.get('name') as string)?.trim()
    const assetType = (formData.get('asset_type') as string) ?? 'VEHICLE'
    const purchaseValue = Math.abs(parseFloat((formData.get('purchase_value') as string) ?? '0'))
    const purchaseDate = (formData.get('purchase_date') as string) || new Date().toISOString().slice(0, 10)
    const depRate = parseFloat((formData.get('depreciation_rate_annual') as string) ?? '0.15')
    const residual = parseFloat((formData.get('residual_value_home') as string) ?? '0') || null

    if (!name) return { success: false, error: 'Nombre requerido' }
    if (purchaseValue <= 0) return { success: false, error: 'Valor de compra requerido' }

    const { error } = await supabase.from('assets').insert({
      user_id: user.id, name, asset_type: assetType, purchase_value: purchaseValue,
      purchase_date: purchaseDate, depreciation_rate_annual: depRate, residual_value_home: residual, is_active: true,
    })

    if (error) return { success: false, error: error.message }
    revalidatePath('/patrimonio-neto')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al crear activo' }
  }
}

export async function updateAsset(params: {
  id: string
  name?: string
  purchaseValue?: number
  depreciationRateAnnual?: number
  residualValueHome?: number | null
}): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const update: Record<string, any> = {}
    if (params.name !== undefined) update.name = params.name
    if (params.purchaseValue !== undefined) update.purchase_value = params.purchaseValue
    if (params.depreciationRateAnnual !== undefined) update.depreciation_rate_annual = params.depreciationRateAnnual
    if (params.residualValueHome !== undefined) update.residual_value_home = params.residualValueHome

    const { error } = await supabase.from('assets').update(update).eq('id', params.id).eq('user_id', user.id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/patrimonio-neto')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al actualizar activo' }
  }
}

export async function deleteAsset(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const { error } = await supabase.from('assets').update({ is_active: false }).eq('id', id).eq('user_id', user.id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/patrimonio-neto')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al eliminar activo' }
  }
}
