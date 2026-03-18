import { createAdminClient } from '@/utils/supabase/admin'

function monthKey(d: Date) {
  // YYYY-MM
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export type DebtExtraPaymentPlan = Array<{ debtId: string; amountHome: number }>

export async function planExtraPaymentsToDebts(params: {
  userId: string
  surplusHome: number
  strategy: 'SNOWBALL' | 'AVALANCHE'
  asOfISO: string
}) {
  const supabase = createAdminClient()

  const { userId, surplusHome, strategy, asOfISO } = params
  const asOf = new Date(asOfISO)
  const asOfMonth = monthKey(asOf)

  if (surplusHome <= 0) return []

  const { data: debts, error } = await supabase
    .from('debts')
    .select('id, apr_annual, current_balance_home, debt_type, debt_account_id')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error) throw error
  if (!debts?.length) return []

  // Calcula APR efectiva si hay promo "tasa cero" para el mes actual.
  const { data: promos } = await supabase
    .from('debt_promotions')
    .select('debt_id, promo_start_month, promo_end_month, promo_apr_annual')
    .eq('user_id', userId)

  const getEffectiveApr = (debtId: string) => {
    const p = (promos ?? []).find((x) => x.debt_id === debtId)
    if (!p) return Number((debts as any).find((d: any) => d.id === debtId)?.apr_annual ?? 0)

    const start = monthKey(new Date(p.promo_start_month))
    const end = monthKey(new Date(p.promo_end_month))
    if (asOfMonth >= start && asOfMonth <= end) return Number(p.promo_apr_annual ?? 0)
    return Number((debts as any).find((d: any) => d.id === debtId)?.apr_annual ?? 0)
  }

  const enriched = debts.map((d: any) => ({
    debtId: String(d.id),
    currentBalanceHome: Number(d.current_balance_home ?? 0),
    aprEffective: getEffectiveApr(String(d.id)),
    debtType: d.debt_type as string,
  }))

  const ordered =
    strategy === 'SNOWBALL'
      ? enriched.sort((a, b) => a.currentBalanceHome - b.currentBalanceHome)
      : enriched.sort((a, b) => b.aprEffective - a.aprEffective)

  let remaining = surplusHome
  const plan: DebtExtraPaymentPlan = []

  for (const d of ordered) {
    if (remaining <= 0.000001) break
    if (d.currentBalanceHome <= 0) continue
    const pay = Math.min(remaining, d.currentBalanceHome)
    plan.push({ debtId: d.debtId, amountHome: pay })
    remaining -= pay
  }

  return plan
}

export async function simulateAmortization(params: {
  userId: string
  strategy: 'SNOWBALL' | 'AVALANCHE'
  monthlyPaymentHome: number
  asOfISO: string
}) {
  // Skeleton: devuelve estructura compatible para UI/analytics.
  // Para producción: iterar meses, aplicar APR efectiva por promo, recalcular balances y generar tabla.
  const supabase = createAdminClient()
  const { data: debts } = await supabase
    .from('debts')
    .select('id, current_balance_home, apr_annual, debt_type')
    .eq('user_id', params.userId)
    .eq('is_active', true)

  const runAt = new Date().toISOString()
  return {
    runAt,
    strategy: params.strategy,
    monthlyPaymentHome: params.monthlyPaymentHome,
    debtsCount: debts?.length ?? 0,
    schedule: [] as Array<any>,
  }
}

