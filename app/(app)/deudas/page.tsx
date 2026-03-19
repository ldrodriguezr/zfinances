import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ensureUserOnboarding } from '@/lib/actions/onboarding'
import { planExtraPaymentsToDebts } from '@/lib/debt/debt'
import AgregarDeudaButton from '@/components/modules/AgregarDeudaButton'
import DebtRow from '@/components/modules/DebtRow'

function formatMoney(n: number, c: string = 'CRC') {
  return `${c === 'USD' ? '$' : '₡'}${Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default async function DeudasPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) redirect('/login')

  await ensureUserOnboarding(user.id)

  const { data: settings } = await supabase.from('user_settings').select('debt_strategy, home_currency').eq('user_id', user.id).single()
  const strategy = (settings?.debt_strategy as 'SNOWBALL' | 'AVALANCHE') ?? 'AVALANCHE'
  const homeCurrency = String(settings?.home_currency ?? 'CRC')

  const { data: debts } = await supabase
    .from('debts')
    .select('id, name, debt_type, current_balance_home, apr_annual, min_payment_home, currency')
    .eq('user_id', user.id).eq('is_active', true)
    .order('current_balance_home', { ascending: strategy === 'SNOWBALL' })

  const { data: promos } = await supabase.from('debt_promotions').select('debt_id, promo_apr_annual').eq('user_id', user.id)
  const promoMap = new Map((promos ?? []).map((p: any) => [p.debt_id, Number(p.promo_apr_annual)]))

  const totalDeuda = (debts ?? []).reduce((s, d) => s + Number(d.current_balance_home ?? 0), 0)
  const totalMin = (debts ?? []).reduce((s, d) => s + Number(d.min_payment_home ?? 0), 0)

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const [incR, expR] = await Promise.all([
    supabase.from('transactions').select('amount_home').eq('user_id', user.id).eq('flow_type', 'INCOME').gte('occurred_at', monthStart),
    supabase.from('transactions').select('amount_home').eq('user_id', user.id).eq('flow_type', 'EXPENSE').gte('occurred_at', monthStart),
  ])
  const surplus = Math.max(0,
    (incR.data ?? []).reduce((s: number, r: any) => s + Number(r.amount_home ?? 0), 0) -
    (expR.data ?? []).reduce((s: number, r: any) => s + Number(r.amount_home ?? 0), 0)
  )

  let plan: Array<{ debtId: string; amountHome: number }> = []
  if (surplus > 0) {
    try { plan = await planExtraPaymentsToDebts({ userId: user.id, surplusHome: surplus, strategy, asOfISO: now.toISOString() }) } catch { plan = [] }
  }
  const planMap = new Map(plan.map((p) => [p.debtId, p.amountHome]))

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Deudas</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Estrategia <span className="text-indigo-400 font-medium">{strategy}</span> — {strategy === 'AVALANCHE' ? 'mayor APR primero' : 'menor balance primero'}
          </p>
        </div>
        <AgregarDeudaButton />
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Deuda total</p>
          <p className="text-xl font-black mt-1.5 text-rose-400">{formatMoney(totalDeuda, homeCurrency)}</p>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pago mínimo</p>
          <p className="text-xl font-black mt-1.5 text-amber-400">{formatMoney(totalMin, homeCurrency)}</p>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Surplus</p>
          <p className="text-xl font-black mt-1.5 text-emerald-400">{formatMoney(surplus, homeCurrency)}</p>
        </div>
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-600/15 to-cyan-600/15 border border-indigo-500/20">
          <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Deudas activas</p>
          <p className="text-xl font-black mt-1.5 text-white">{(debts ?? []).length}</p>
        </div>
      </section>

      <div className="rounded-2xl bg-slate-900/40 border border-slate-800/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800/50">
          <h2 className="text-base font-bold text-white">Plan de pagos</h2>
        </div>
        {debts && debts.length > 0 ? (
          <div className="divide-y divide-slate-800/30">
            {debts.map((d: any, i: number) => (
              <DebtRow
                key={d.id}
                debt={d}
                extraPayment={planMap.get(d.id) ?? 0}
                homeCurrency={homeCurrency}
                isTarget={i === 0 && Number(d.current_balance_home) > 0}
                order={i + 1}
                promoApr={promoMap.get(d.id) ?? null}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-slate-500 text-sm">Sin deudas activas</p>
            <p className="text-slate-600 text-xs mt-1">Agrega tus deudas para ver el plan {strategy}</p>
          </div>
        )}
      </div>
    </div>
  )
}
