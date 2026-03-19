'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

type ActionResult = { success: true } | { success: false; error: string }

export async function getOrCreateMonthlyBudget(userId: string, monthStart: string) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('monthly_budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month_start', monthStart)
    .maybeSingle()

  if (existing) return existing

  const { data: created, error } = await supabase
    .from('monthly_budgets')
    .insert({
      user_id: userId,
      month_start: monthStart,
      currency: 'CRC',
      income_total_home: 0,
      available_home: 0,
      status: 'ACTIVE',
    })
    .select('*')
    .single()

  if (error) throw error
  return created
}

export async function assignToCategory(params: {
  budgetId: string
  categoryId: string
  amount: number
}): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authorized' }

    const { data: existing } = await supabase
      .from('budget_lines')
      .select('id')
      .eq('budget_id', params.budgetId)
      .eq('category_level1_id', params.categoryId)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('budget_lines')
        .update({ budget_amount_home: params.amount })
        .eq('id', existing.id)
      if (error) return { success: false, error: error.message }
    } else {
      const { error } = await supabase
        .from('budget_lines')
        .insert({
          budget_id: params.budgetId,
          user_id: user.id,
          category_level1_id: params.categoryId,
          budget_amount_home: params.amount,
          spent_amount_home: 0,
          execution_pct: 0,
        })
      if (error) return { success: false, error: error.message }
    }

    revalidatePath('/budget')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error assigning' }
  }
}

export async function getBudgetData(userId: string, monthStart: string) {
  const supabase = await createClient()

  const budget = await getOrCreateMonthlyBudget(userId, monthStart)

  const { data: budgetLines } = await supabase
    .from('budget_lines')
    .select('*')
    .eq('budget_id', budget.id)

  const monthEnd = new Date(monthStart)
  monthEnd.setMonth(monthEnd.getMonth() + 1)

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, category_level1_id, category_level2_id, flow_type, amount_home, occurred_at')
    .eq('user_id', userId)
    .gte('occurred_at', monthStart)
    .lt('occurred_at', monthEnd.toISOString().slice(0, 10))

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, level, parent_category_id, category_kind')
    .eq('user_id', userId)
    .order('name')

  const groups = (categories ?? []).filter((c: any) => c.level === 1)
  const children = (categories ?? []).filter((c: any) => c.level === 2)

  const assignedMap = new Map<string, number>()
  for (const bl of budgetLines ?? []) {
    assignedMap.set(bl.category_level1_id, Number(bl.budget_amount_home))
  }

  const activityByCategory = new Map<string, number>()
  for (const tx of transactions ?? []) {
    const catId = tx.category_level1_id || tx.category_level2_id
    if (!catId) continue
    const cat = (categories ?? []).find((c: any) => c.id === catId)
    if (!cat) continue

    const groupId = cat.level === 1 ? cat.id : cat.parent_category_id
    if (!groupId) continue

    const amount = Number(tx.amount_home)
    const signed = tx.flow_type === 'EXPENSE' ? -amount : amount
    activityByCategory.set(groupId, (activityByCategory.get(groupId) || 0) + signed)
  }

  const totalIncome = (transactions ?? [])
    .filter((tx: any) => tx.flow_type === 'INCOME')
    .reduce((sum: number, tx: any) => sum + Number(tx.amount_home), 0)

  const totalAssigned = Array.from(assignedMap.values()).reduce((sum, v) => sum + v, 0)
  const readyToAssign = totalIncome - totalAssigned

  const categoryGroupsData = groups
    .filter((g: any) => g.category_kind === 'EXPENSE')
    .map((g: any) => {
      const cats = children.filter((c: any) => c.parent_category_id === g.id)
      const assigned = assignedMap.get(g.id) || 0
      const activity = activityByCategory.get(g.id) || 0
      const available = assigned + activity

      return {
        id: g.id,
        name: g.name,
        assigned,
        activity,
        available,
        categories: cats.map((c: any) => ({
          id: c.id,
          name: c.name,
        })),
      }
    })

  return {
    budget,
    readyToAssign,
    totalIncome,
    totalAssigned,
    groups: categoryGroupsData,
    assignedMap: Object.fromEntries(assignedMap),
    activityMap: Object.fromEntries(activityByCategory),
  }
}
