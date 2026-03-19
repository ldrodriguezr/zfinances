'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import { postIngestedTransactionToLedger } from '@/lib/ledger/ledger'

export type ActionResult = { success: true } | { success: false; error: string }

export async function createTransaction(params: {
  date: string
  payee: string
  categoryId?: string
  memo?: string
  accountId: string
  outflow?: number
  inflow?: number
  currency?: string
}): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authorized' }

    const amount = (params.outflow || 0) > 0 ? params.outflow! : (params.inflow || 0)
    const flowType = (params.outflow || 0) > 0 ? 'EXPENSE' : 'INCOME'
    const currency = params.currency || 'CRC'

    const externalReference = crypto
      .createHash('sha256')
      .update(`${user.id}|${params.accountId}|${params.date}|${amount}|${flowType}|${Date.now()}`)
      .digest('hex')

    await postIngestedTransactionToLedger({
      userId: user.id,
      sourceType: 'MANUAL',
      occurredAtISO: new Date(params.date).toISOString(),
      description: params.memo || params.payee,
      merchant: params.payee,
      externalReference,
      amount: Math.abs(amount),
      currency,
      flowType,
      isDebitLike: flowType === 'EXPENSE',
      liquidityAccountId: params.accountId,
      categoryLevel1Id: params.categoryId || undefined,
    })

    revalidatePath('/budget')
    revalidatePath('/accounts')
    revalidatePath('/')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error creating transaction' }
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
    if (!user) return { success: false, error: 'Not authorized' }

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
    revalidatePath('/budget')
    revalidatePath('/accounts')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error updating' }
  }
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authorized' }

    await supabase.from('transaction_entries').delete().eq('transaction_id', id).eq('user_id', user.id)
    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id)

    if (error) return { success: false, error: error.message }
    revalidatePath('/budget')
    revalidatePath('/accounts')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error deleting' }
  }
}
