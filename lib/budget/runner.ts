import { createAdminClient } from '@/utils/supabase/admin'
import { contributeSinkingFundsForMonth, refreshBudgetExecutionForMonth } from '@/lib/budget/zbb'

function monthStartISOFromNow(now: Date) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0))
  return monthStart.toISOString()
}

export async function runBudgetExecutionForAllUsers(params?: { nowISO?: string }) {
  const supabase = createAdminClient()
  const now = params?.nowISO ? new Date(params.nowISO) : new Date()
  const monthStartISO = monthStartISOFromNow(now)

  const { data: settingsRows, error } = await supabase.from('user_settings').select('user_id')
  if (error) throw error

  for (const s of settingsRows ?? []) {
    const userId = String((s as any).user_id)
    await contributeSinkingFundsForMonth({ userId, monthStartISO })
    await refreshBudgetExecutionForMonth({ userId, monthStartISO })
  }

  return { ok: true, monthStartISO }
}

