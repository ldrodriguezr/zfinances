'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import { postIngestedTransactionToLedger } from '@/lib/ledger/ledger'

export async function createTransaction(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? process.env.DEV_USER_ID
  if (!userId) throw new Error('No autorizado (falta login o DEV_USER_ID)')

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
    .update(
      `${userId}|${liquidityAccountId}|${occurredAtISO}|${amount}|${currency}|${flowType}|${description}|${merchant ?? ''}|${categoryLevel1Id ?? ''}|${categoryLevel2Id ?? ''}|${tagLevel3Id ?? ''}`
    )
    .digest('hex')

  await postIngestedTransactionToLedger({
    userId,
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

  return { success: true }
}