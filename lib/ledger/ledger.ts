import { createAdminClient } from '@/utils/supabase/admin'

type EntrySide = 'DEBIT' | 'CREDIT'

function toHomeAmount(amount: number, fxRate: number) {
  // fxRate convierte 1 unidad de la moneda de la transacción a la moneda home.
  return amount * fxRate
}

async function getHomeCurrency(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('home_currency, debt_strategy')
    .eq('user_id', userId)
    .single()

  if (error) throw error
  return data.home_currency as string
}

async function getFxRate(supabase: any, userId: string, fromCurrency: string, toCurrency: string, rateDateISO: string) {
  if (fromCurrency === toCurrency) return 1

  const rateDate = rateDateISO.slice(0, 10)
  const { data, error } = await supabase
    .from('fx_rates')
    .select('rate_date, rate')
    .eq('user_id', userId)
    .eq('base_currency', fromCurrency)
    .eq('quote_currency', toCurrency)
    .eq('rate_date', rateDate)
    .single()

  if (error) throw error
  return Number(data.rate)
}

async function getOrCreateSuspenseAccount(supabase: any, userId: string, currency: string) {
  const name = `SUSPENSE:${currency}`
  const { data: existing } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name)
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const { data, error } = await supabase
    .from('accounts')
    .upsert(
      {
        user_id: userId,
        name,
        account_type: 'LIQUIDITY',
        currency,
        is_active: true,
      },
      { onConflict: 'user_id,name' }
    )
    .select('id')

  if (error) throw error
  return (data?.[0]?.id ?? data?.id) as string
}

async function getLiquidityAccountId(supabase: any, userId: string, currency: string) {
  // Prioridad: una cuenta de liquidez activa con la misma moneda.
  const { data, error } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('account_type', 'LIQUIDITY')
    .eq('currency', currency)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data?.id as string | undefined
}

export async function postIngestedTransactionToLedger(params: {
  userId: string
  sourceType: 'GMAIL' | 'P2P' | 'MANUAL' | string
  occurredAtISO: string
  description?: string
  merchant?: string
  externalReference?: string
  amount: number // siempre positivo
  currency: string
  fxRate?: number // opcional; si no viene se resuelve desde fx_rates
  isDebitLike?: boolean // true si el dinero sale (ej: cargo), false si entra (ej: abono)
  flowType?: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  counterpartAccountId?: string
  liquidityAccountId?: string
  categoryLevel1Id?: string
  categoryLevel2Id?: string
  tagLevel3Id?: string
}) {
  const supabase = createAdminClient()

  const { userId } = params
  const homeCurrency = await getHomeCurrency(supabase, userId)
  const fxRateResolved =
    params.fxRate != null ? Number(params.fxRate) : await getFxRate(supabase, userId, params.currency, homeCurrency, params.occurredAtISO)

  const liquidityAccountId =
    params.liquidityAccountId ??
    (await getLiquidityAccountId(supabase, userId, params.currency)) ??
    (await getLiquidityAccountId(supabase, userId, homeCurrency)) // fallback

  if (!liquidityAccountId) {
    throw new Error(`No existe cuenta de liquidez para moneda ${params.currency} en user_id=${userId}`)
  }

  const suspenseAccountId = params.counterpartAccountId ?? (await getOrCreateSuspenseAccount(supabase, userId, params.currency))

  const liquiditySide: EntrySide = params.isDebitLike ? 'CREDIT' : 'DEBIT'
  const counterSide: EntrySide = liquiditySide === 'DEBIT' ? 'CREDIT' : 'DEBIT'

  const homeAmount = toHomeAmount(params.amount, fxRateResolved)
  const flowType: 'INCOME' | 'EXPENSE' | 'TRANSFER' =
    params.flowType ??
    (params.isDebitLike ? 'EXPENSE' : 'INCOME')

  const { data: txRow, error: txErr } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      source_type: params.sourceType,
      occurred_at: params.occurredAtISO,
      description: params.description ?? params.merchant ?? null,
      merchant: params.merchant ?? null,
      external_reference: params.externalReference ?? null,
      flow_type: flowType,
      amount_currency: params.amount,
      currency: params.currency,
      fx_rate: fxRateResolved,
      amount_home: homeAmount,
      category_level1_id: params.categoryLevel1Id ?? null,
      category_level2_id: params.categoryLevel2Id ?? null,
      tag_level3_id: params.tagLevel3Id ?? null,
      status: 'PROCESSED',
    })
    .select('id')
    .single()

  if (txErr) throw txErr
  const transactionId = txRow.id as string

  const { error: eErr } = await supabase.from('transaction_entries').insert([
    {
      user_id: userId,
      transaction_id: transactionId,
      account_id: liquidityAccountId,
      side: liquiditySide,
      currency: params.currency,
      amount: params.amount,
      fx_rate: fxRateResolved,
      home_amount: homeAmount,
      entry_description: 'Liquidity leg (ingestion)',
    },
    {
      user_id: userId,
      transaction_id: transactionId,
      account_id: suspenseAccountId,
      side: counterSide,
      currency: params.currency,
      amount: params.amount,
      fx_rate: fxRateResolved,
      home_amount: homeAmount,
      entry_description: params.counterpartAccountId ? 'Counterpart leg (debt/account)' : 'Counterpart leg (suspense)',
    },
  ])

  if (eErr) throw eErr

  return { transactionId }
}

