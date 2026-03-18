import { createAdminClient } from '@/utils/supabase/admin'
import { postIngestedTransactionToLedger } from '@/lib/ledger/ledger'
import { planExtraPaymentsToDebts } from '@/lib/debt/debt'

export async function runSweepToDebtMonthEnd(params: { userId: string; monthEndISO: string }) {
  const supabase = createAdminClient()
  const { userId, monthEndISO } = params

  const monthEnd = new Date(monthEndISO)
  const monthEndYMD = monthEnd.toISOString().slice(0, 10)
  const monthStart = new Date(Date.UTC(monthEnd.getUTCFullYear(), monthEnd.getUTCMonth(), 1))
  const monthStartYMD = monthStart.toISOString().slice(0, 10)
  const nextMonthStart = new Date(Date.UTC(monthEnd.getUTCFullYear(), monthEnd.getUTCMonth() + 1, 1)).toISOString()

  const { data: incomeRows, error: iErr } = await supabase
    .from('transactions')
    .select('amount_home')
    .eq('user_id', userId)
    .eq('flow_type', 'INCOME')
    .gte('occurred_at', monthStartYMD)
    .lt('occurred_at', nextMonthStart)

  if (iErr) throw iErr
  const incomeHome = (incomeRows ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_home ?? 0), 0)

  const { data: expenseRows, error: eErr } = await supabase
    .from('transactions')
    .select('amount_home')
    .eq('user_id', userId)
    .eq('flow_type', 'EXPENSE')
    .gte('occurred_at', monthStartYMD)
    .lt('occurred_at', nextMonthStart)

  if (eErr) throw eErr
  const expenseHome = (expenseRows ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_home ?? 0), 0)

  const surplusHome = incomeHome - expenseHome

  // Sweep rule
  const { data: sweepRule } = await supabase
    .from('sweep_rules')
    .select('percent_of_surplus')
    .eq('user_id', userId)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  const percent = Number(sweepRule?.percent_of_surplus ?? 100)
  const sweepAmountHome = surplusHome > 0 ? (surplusHome * percent) / 100 : 0

  // Insert close record
  const { data: closeRow, error: closeErr } = await supabase
    .from('month_end_closings')
    .upsert(
      {
        user_id: userId,
        month_start: monthStartYMD,
        month_end: monthEndYMD,
        net_income_home: incomeHome,
        total_expenses_home: expenseHome,
        surplus_home: surplusHome,
        status: 'CLOSED',
      },
      { onConflict: 'user_id,month_end' }
    )
    .select('id')
    .single()

  if (closeErr) throw closeErr
  const closingId = String((closeRow as any).id)

  const { data: existingSweep } = await supabase
    .from('sweep_debt_payments')
    .select('id')
    .eq('closing_id', closingId)
    .limit(1)
    .maybeSingle()

  if (existingSweep?.id) {
    return { surplusHome, sweepAmountHome: 0, closingId, planned: 0, alreadyClosed: true }
  }

  if (sweepAmountHome <= 0) return { surplusHome: 0, sweepAmountHome: 0, closingId }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('debt_strategy')
    .eq('user_id', userId)
    .maybeSingle()

  const strategy = (settings?.debt_strategy ?? 'AVALANCHE') as 'SNOWBALL' | 'AVALANCHE'

  const { data: userSettingsHome } = await supabase
    .from('user_settings')
    .select('home_currency')
    .eq('user_id', userId)
    .maybeSingle()

  const homeCurrency = String(userSettingsHome?.home_currency ?? 'CRC')

  const plan = await planExtraPaymentsToDebts({
    userId,
    surplusHome: sweepAmountHome,
    strategy,
    asOfISO: monthEndISO,
  })

  if (!plan.length) return { surplusHome, sweepAmountHome, closingId, planned: 0 }

  // Fetch debt details for counterpart accounts.
  const debtIds = plan.map((p) => p.debtId)
  const { data: debtRows } = await supabase
    .from('debts')
    .select('id, name, currency, debt_account_id, current_balance_home')
    .eq('user_id', userId)
    .in('id', debtIds)

  const debtById = new Map((debtRows ?? []).map((d: any) => [String(d.id), d]))

  for (const p of plan) {
    const debt = debtById.get(p.debtId)
    if (!debt) continue
    const debtAccountId = String(debt.debt_account_id ?? '')
    const hasDebtAccount = Boolean(debtAccountId) && debtAccountId !== 'null'

    const debtCurrency = String(debt.currency ?? homeCurrency)
    let amountCurrency = p.amountHome
    if (debtCurrency !== homeCurrency) {
      const { data: fxRow, error: fxErr } = await supabase
        .from('fx_rates')
        .select('rate')
        .eq('user_id', userId)
        .eq('base_currency', debtCurrency)
        .eq('quote_currency', homeCurrency)
        .eq('rate_date', monthEndYMD)
        .maybeSingle()

      if (fxErr) throw fxErr
      const rate = Number(fxRow?.rate ?? 0)
      if (!rate || rate <= 0) throw new Error(`Falta fx_rate ${debtCurrency}->${homeCurrency} para ${monthEndYMD}`)
      amountCurrency = p.amountHome / rate
    }

    // Extra payment record (auditable).
    await supabase.from('sweep_debt_payments').upsert(
      {
        closing_id: closingId,
        user_id: userId,
        debt_id: p.debtId,
        amount_home: p.amountHome,
        generated_transaction_id: null,
      },
      { onConflict: 'closing_id,debt_id' }
    )

    await supabase.from('debt_extra_payments').insert({
      user_id: userId,
      debt_id: p.debtId,
      payment_date: new Date().toISOString(),
      amount_home: p.amountHome,
      source: 'SWEEP',
      related_transaction_id: null,
    })

    // Posting de una transacción contable (flujo de caja hacia la deuda).
    // Se utiliza el `debt_account_id` como contrapartida si existe; si no, cae a SUSPENSE.
    await postIngestedTransactionToLedger({
      userId,
      sourceType: 'SWEEP',
      occurredAtISO: monthEndISO,
      description: `Pago extraordinario (${strategy}) -> ${debt.name ?? p.debtId}`,
      externalReference: `SWEEP:${closingId}:${p.debtId}`,
      amount: amountCurrency,
      currency: debtCurrency,
      isDebitLike: true,
      flowType: 'EXPENSE',
      counterpartAccountId: hasDebtAccount ? debtAccountId : undefined,
    })

    // Actualiza balance de la deuda en home (simplificado).
    const currentBalance = Number(debt.current_balance_home ?? 0)
    const nextBalance = Math.max(0, currentBalance - Number(p.amountHome))
    await supabase.from('debts').update({ current_balance_home: nextBalance }).eq('id', p.debtId)
  }

  return { surplusHome, sweepAmountHome, closingId, planned: plan.length }
}

