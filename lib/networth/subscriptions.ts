import crypto from 'crypto'
import { createAdminClient } from '@/utils/supabase/admin'

function monthKeyFromISO(iso: string) {
  const d = new Date(iso)
  return d.toISOString().slice(0, 7) // YYYY-MM
}

function monthStartFromMonthKey(key: string) {
  // key: YYYY-MM
  const [y, m] = key.split('-').map((x) => Number(x))
  const d = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
  return d.toISOString().slice(0, 10)
}

export async function detectSubscriptionsForUserMonthEnd(params: { userId: string; monthEndISO: string }) {
  const supabase = createAdminClient()
  const { userId, monthEndISO } = params

  const monthEnd = new Date(monthEndISO)
  const currentMonthKey = monthEnd.toISOString().slice(0, 7)

  const prev = new Date(Date.UTC(monthEnd.getUTCFullYear(), monthEnd.getUTCMonth() - 1, monthEnd.getUTCDate()))
  const prevMonthKey = prev.toISOString().slice(0, 7)

  // Ventana: últimos 3 meses
  const windowStart = new Date(Date.UTC(monthEnd.getUTCFullYear(), monthEnd.getUTCMonth() - 2, 1))
  const windowStartISO = windowStart.toISOString()

  const { data: rows, error } = await supabase
    .from('transactions')
    .select('id, occurred_at, amount_home, merchant, category_level1_id, flow_type')
    .eq('user_id', userId)
    .eq('flow_type', 'EXPENSE')
    .gte('occurred_at', windowStartISO)

  if (error) throw error

  const expenses = rows ?? []

  const byMerchant = new Map<
    string,
    Array<{ occurred_at: string; amount_home: number; category_level1_id: string | null }>
  >()

  for (const r of expenses) {
    const merchant = String((r as any).merchant ?? '').trim()
    if (!merchant) continue
    const sig = merchant.toUpperCase()
    const list = byMerchant.get(sig) ?? []
    list.push({
      occurred_at: String((r as any).occurred_at),
      amount_home: Number((r as any).amount_home ?? 0),
      category_level1_id: (r as any).category_level1_id ?? null,
    })
    byMerchant.set(sig, list)
  }

  for (const [merchantSig, list] of byMerchant.entries()) {
    const current = list.filter((x) => monthKeyFromISO(x.occurred_at) === currentMonthKey)
    const previous = list.filter((x) => monthKeyFromISO(x.occurred_at) === prevMonthKey)

    if (current.length === 0 || previous.length === 0) continue

    const avgCurrent = current.reduce((a, x) => a + x.amount_home, 0) / current.length
    const avgPrev = previous.reduce((a, x) => a + x.amount_home, 0) / previous.length
    const denom = Math.max(1e-9, Math.abs(avgPrev))
    const pctChange = ((avgCurrent - avgPrev) / denom) * 100

    // Criterio simple: recurrencia mensual (2 meses seguidos) y variación razonable.
    if (Math.abs(pctChange) > 20) continue

    const recurring_amount_home = (avgCurrent + avgPrev) / 2
    const start_date = monthStartFromMonthKey(prevMonthKey)

    // Categoría más frecuente entre current/previous
    const counts = new Map<string, number>()
    for (const x of [...current, ...previous]) {
      if (!x.category_level1_id) continue
      const key = String(x.category_level1_id)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const bestCategoryId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    const merchant_signature = crypto.createHash('sha256').update(`${userId}|${merchantSig}`).digest('hex')

    await supabase.from('subscriptions').upsert(
      {
        user_id: userId,
        merchant_signature,
        category_level1_id: bestCategoryId,
        recurring_amount_home,
        start_date,
        last_seen_at: monthEnd.toISOString().slice(0, 10),
        next_due_at: new Date(Date.UTC(monthEnd.getUTCFullYear(), monthEnd.getUTCMonth() + 1, 1)).toISOString().slice(0, 10),
        interval_months: 1,
        confidence: Math.min(100, 60 + Math.max(0, 20 - Math.abs(pctChange)) * 2),
        is_active: true,
      },
      { onConflict: 'user_id,merchant_signature,start_date' }
    )
  }

  return { ok: true }
}

