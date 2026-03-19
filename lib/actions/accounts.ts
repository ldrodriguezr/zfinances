'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

type ActionResult = { success: true } | { success: false; error: string }

export async function createAccount(params: {
  name: string
  accountType: 'LIQUIDITY' | 'CREDIT'
  currency: string
}): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authorized' }

    const { error } = await supabase.from('accounts').insert({
      user_id: user.id,
      name: params.name,
      account_type: params.accountType,
      currency: params.currency,
      is_active: true,
    })

    if (error) return { success: false, error: error.message }
    revalidatePath('/accounts')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function getAccountsWithBalances(userId: string) {
  const supabase = await createClient()

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, account_type, currency, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('name')

  const { data: entries } = await supabase
    .from('transaction_entries')
    .select('account_id, side, home_amount')
    .eq('user_id', userId)

  const balanceMap = new Map<string, number>()
  for (const e of entries ?? []) {
    const current = balanceMap.get(e.account_id) || 0
    const amount = Number(e.home_amount)
    balanceMap.set(
      e.account_id,
      current + (e.side === 'DEBIT' ? amount : -amount)
    )
  }

  return (accounts ?? []).map((acc: any) => ({
    ...acc,
    balance: balanceMap.get(acc.id) || 0,
  }))
}

export async function getTransactionsForAccount(userId: string, accountId?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('transactions')
    .select('id, occurred_at, merchant, description, flow_type, amount_home, amount_currency, currency, category_level1_id, category_level2_id')
    .eq('user_id', userId)
    .order('occurred_at', { ascending: false })
    .limit(200)

  if (accountId) {
    const { data: entryTxIds } = await supabase
      .from('transaction_entries')
      .select('transaction_id')
      .eq('account_id', accountId)
      .eq('user_id', userId)

    const txIds = (entryTxIds ?? []).map((e: any) => e.transaction_id)
    if (txIds.length === 0) return []

    query = query.in('id', txIds)
  }

  const { data } = await query
  return data ?? []
}
