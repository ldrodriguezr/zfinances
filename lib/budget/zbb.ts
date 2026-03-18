import { createAdminClient } from '@/utils/supabase/admin'

export async function refreshBudgetExecutionForMonth(params: { userId: string; monthStartISO: string }) {
  const supabase = createAdminClient()
  const { userId, monthStartISO } = params

  const monthStart = new Date(monthStartISO)
  const monthStartYMD = monthStart.toISOString().slice(0, 10)
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1))

  // Update income/expense in a simple way: sum transactions by flow_type and month.
  const { data: incomeRows } = await supabase
    .from('transactions')
    .select('amount_home')
    .eq('user_id', userId)
    .eq('flow_type', 'INCOME')
    .gte('occurred_at', monthStartYMD)
    .lt('occurred_at', monthEnd.toISOString())

  const incomeHome = (incomeRows ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_home ?? 0), 0)

  const { data: expenseRows } = await supabase
    .from('transactions')
    .select('amount_home')
    .eq('user_id', userId)
    .eq('flow_type', 'EXPENSE')
    .gte('occurred_at', monthStartYMD)
    .lt('occurred_at', monthEnd.toISOString())

  const expenseHome = (expenseRows ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_home ?? 0), 0)

  const { data: budgets } = await supabase
    .from('monthly_budgets')
    .select('id, currency')
    .eq('user_id', userId)
    .eq('month_start', monthStartYMD)

  if (!budgets?.length) return { ok: true, created: 0 }

  const budgetId = (budgets[0] as any).id as string
  const budgetCurrency = String((budgets[0] as any).currency ?? 'CRC')

  await supabase
    .from('monthly_budgets')
    .update({
      income_total_home: incomeHome,
      available_home: incomeHome - expenseHome,
    })
    .eq('id', budgetId)

  // Las líneas por categoría se recalculan en otro paso si quieres asignación por ZBB.
  // Aquí sólo marcamos gasto total a nivel de línea usando category_level1_id y flow_type=EXPENSE.
  const { data: lines } = await supabase
    .from('budget_lines')
    .select('id, category_level1_id, budget_amount_home, spent_amount_home, execution_pct')
    .eq('budget_id', budgetId)
  for (const line of lines ?? []) {
    const { data: spentRows } = await supabase
      .from('transactions')
      .select('amount_home')
      .eq('user_id', userId)
      .eq('flow_type', 'EXPENSE')
      .eq('category_level1_id', line.category_level1_id)
      .gte('occurred_at', monthStartYMD)
      .lt('occurred_at', monthEnd.toISOString())

    const spent = (spentRows ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_home ?? 0), 0)
    const budgetAmount = Number(line.budget_amount_home ?? 0)
    const pct = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0

    await supabase.from('budget_lines').update({ spent_amount_home: spent, execution_pct: pct }).eq('id', line.id)

    const thresholds = [75, 90, 100]
    for (const threshold of thresholds) {
      if (pct >= threshold) {
        await supabase.from('budget_alerts').upsert(
          {
            user_id: userId,
            budget_id: budgetId,
            category_level1_id: line.category_level1_id,
            threshold_pct: threshold,
            triggered_at: new Date().toISOString(),
          },
          { onConflict: 'budget_id,category_level1_id,threshold_pct' }
        )
      }
    }
  }

  return { ok: true, budgetId, budgetCurrency, incomeHome, expenseHome }
}

export async function contributeSinkingFundsForMonth(params: { userId: string; monthStartISO: string }) {
  const supabase = createAdminClient()
  const { userId, monthStartISO } = params

  const d = new Date(monthStartISO)
  const month = d.getUTCMonth() + 1

  const { data: funds, error } = await supabase
    .from('sinking_funds')
    .select('id, target_month, contribution_monthly_home, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error) throw error

  for (const f of funds ?? []) {
    const targetMonth = Number((f as any).target_month ?? 1)
    if (month > targetMonth) continue

    const monthStartYMD = d.toISOString().slice(0, 10)
    await supabase.from('sinking_fund_contributions').upsert(
      {
        sinking_fund_id: String((f as any).id),
        user_id: userId,
        month_start: monthStartYMD,
        amount_home: Number((f as any).contribution_monthly_home ?? 0),
      },
      { onConflict: 'sinking_fund_id,month_start' }
    )
  }

  return { ok: true }
}

