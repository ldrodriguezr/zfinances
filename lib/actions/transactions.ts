'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import { postIngestedTransactionToLedger } from '@/lib/ledger/ledger'

export type ActionResult = { success: true } | { success: false; error: string }

export async function createTransaction(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const amountRaw = formData.get('amount') as string
    const currency = formData.get('currency') as 'CRC' | 'USD'
    const liquidityAccountId = formData.get('account_id') as string
    const date = formData.get('date') as string
    const description = (formData.get('description') as string) ?? ''
    const merchant = (formData.get('merchant') as string) ?? null
    const flowType = (formData.get('flow_type') as 'INCOME' | 'EXPENSE' | 'TRANSFER') ?? 'EXPENSE'
    const categoryLevel1Id = (formData.get('category_level1_id') as string) || undefined
    const categoryLevel2Id = (formData.get('category_level2_id') as string) || undefined
    const tagLevel3Id = (formData.get('tag_level3_id') as string) || undefined

    const amount = Math.abs(parseFloat(amountRaw))
    const occurredAtISO = new Date(date).toISOString()

    const externalReference = crypto
      .createHash('sha256')
      .update(`${user.id}|${liquidityAccountId}|${occurredAtISO}|${amount}|${currency}|${flowType}|${description}|${merchant ?? ''}|${Date.now()}`)
      .digest('hex')

    await postIngestedTransactionToLedger({
      userId: user.id,
      sourceType: 'MANUAL',
      occurredAtISO,
      description,
      merchant: merchant ?? undefined,
      externalReference,
      amount,
      currency,
      flowType,
      isDebitLike: flowType === 'EXPENSE',
      liquidityAccountId,
      categoryLevel1Id,
      categoryLevel2Id,
      tagLevel3Id,
    })

    revalidatePath('/flujo-caja')
    revalidatePath('/')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error al crear transacción' }
  }
}

export async function updateTransaction(params: {
  id: string
  description?: string
  merchant?: string
  categoryLevel1Id?: string | null
  flowType?: string
  occurredAt?: string
}): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    const update: Record<string, any> = {}
    if (params.description !== undefined) update.description = params.description
    if (params.merchant !== undefined) update.merchant = params.merchant
    if (params.categoryLevel1Id !== undefined) update.category_level1_id = params.categoryLevel1Id || null
    if (params.flowType !== undefined) update.flow_type = params.flowType
    if (params.occurredAt !== undefined) update.occurred_at = params.occurredAt

    const { error } = await supabase
      .from('transactions')
      .update(update)
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) return { success: false, error: error.message }
    revalidatePath('/flujo-caja')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al actualizar' }
  }
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autorizado' }

    await supabase.from('transaction_entries').delete().eq('transaction_id', id).eq('user_id', user.id)
    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id)

    if (error) return { success: false, error: error.message }
    revalidatePath('/flujo-caja')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al eliminar' }
  }
}
