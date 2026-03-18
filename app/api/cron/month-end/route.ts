import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { runSweepToDebtMonthEnd } from '@/lib/sweep/sweep'
import { runNetWorthMonthEndSnapshot } from '@/lib/networth/networth'
import { detectSubscriptionsForUserMonthEnd } from '@/lib/networth/subscriptions'

function isLastDayOfMonthUTC(d: Date) {
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
  return last.getUTCDate() === d.getUTCDate()
}

export async function GET() {
  const now = new Date()
  if (!isLastDayOfMonthUTC(now)) {
    return NextResponse.json({ ok: false, skipped: true })
  }

  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  const monthEndISO = last.toISOString()

  const supabase = createAdminClient()
  const { data: settings } = await supabase.from('user_settings').select('user_id')

  const userIds = (settings ?? []).map((s: any) => String(s.user_id)).filter(Boolean)

  for (const userId of userIds) {
    await runSweepToDebtMonthEnd({ userId, monthEndISO })
    await runNetWorthMonthEndSnapshot({ userId, monthEndISO })
    await detectSubscriptionsForUserMonthEnd({ userId, monthEndISO })
  }

  return NextResponse.json({ ok: true, monthEndISO })
}

