import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ensureUserOnboarding } from '@/lib/actions/onboarding'
import { planExtraPaymentsToDebts } from '@/lib/debt/debt'
import AgregarDeudaButton from '@/components/modules/AgregarDeudaButton'

function formatMoney(amount: number, currency: string = 'CRC') {
  const sym = currency === 'USD' ? '$' : '₡'
  return `${sym}${Number(amount).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default async function DeudasPage() {
  const supabase = await createClient()

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) redirect('/login')

  await ensureUserOnboarding(user.id)

  const { data: settings } = await supabase
    .from('user_settings')
    .select('debt_strategy, home_currency')
    .eq('user_id', user.id)
    .single()

  const strategy = (settings?.debt_strategy as 'SNOWBALL' | 'AVALANCHE') ?? 'AVALANCHE'
  const homeCurrency = String(settings?.home_currency ?? 'CRC')

  const { data: debts } = await supabase
    .from('debts')
    .select('id, name, debt_type, current_balance_home, apr_annual, min_payment_home, currency')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('current_balance_home', { ascending: strategy === 'SNOWBALL' })

  const { data: promos } = await supabase
    .from('debt_promotions')
    .select('debt_id, label, promo_start_month, promo_end_month, promo_apr_annual')
    .eq('user_id', user.id)

  const promoMap = new Map((promos ?? []).map((p: any) => [p.debt_id, p]))

  const totalDeuda = (debts ?? []).reduce((acc, d) => acc + Number(d.current_balance_home ?? 0), 0)
  const totalMinPayment = (debts ?? []).reduce((acc, d) => acc + Number(d.min_payment_home ?? 0), 0)

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const [incomeRes, expenseRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount_home')
      .eq('user_id', user.id)
      .eq('flow_type', 'INCOME')
      .gte('occurred_at', monthStart.toISOString()),
    supabase
      .from('transactions')
      .select('amount_home')
      .eq('user_id', user.id)
      .eq('flow_type', 'EXPENSE')
      .gte('occurred_at', monthStart.toISOString()),
  ])

  const income = (incomeRes.data ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_home ?? 0), 0)
  const expense = (expenseRes.data ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_home ?? 0), 0)
  const surplus = Math.max(0, income - expense)

  let plan: Array<{ debtId: string; amountHome: number }> = []
  if (surplus > 0) {
    try {
      plan = await planExtraPaymentsToDebts({ userId: user.id, surplusHome: surplus, strategy, asOfISO: now.toISOString() })
    } catch {
      plan = []
    }
  }

  const planMap = new Map(plan.map((p) => [p.debtId, p.amountHome]))

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white">Deudas</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Estrategia <span className="text-indigo-400 font-medium">{strategy}</span> — plan de pagos extra basado en surplus
          </p>
        </div>
        <AgregarDeudaButton />
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Deuda total</p>
          <h3 className="text-2xl font-black mt-2 text-rose-400">{formatMoney(totalDeuda, homeCurrency)}</h3>
        </div>
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pago mínimo total</p>
          <h3 className="text-2xl font-black mt-2 text-amber-400">{formatMoney(totalMinPayment, homeCurrency)}</h3>
        </div>
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Surplus disponible</p>
          <h3 className="text-2xl font-black mt-2 text-emerald-400">{formatMoney(surplus, homeCurrency)}</h3>
        </div>
        <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-600/20 to-cyan-600/20 border border-indigo-500/30">
          <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Estrategia</p>
          <h3 className="text-2xl font-black mt-2 text-white">{strategy}</h3>
          <p className="text-[10px] text-indigo-200/60 mt-1">
            {strategy === 'AVALANCHE' ? 'Mayor APR primero' : 'Menor balance primero'}
          </p>
        </div>
      </section>

      <div className="rounded-2xl bg-slate-900/40 border border-slate-800/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/50">
          <h2 className="text-lg font-bold text-white">Plan de pagos</h2>
        </div>
        {debts && debts.length > 0 ? (
          <div className="divide-y divide-slate-800/40">
            {debts.map((d: any, idx: number) => {
              const promo = promoMap.get(d.id)
              const extra = planMap.get(d.id) ?? 0
              const apr = promo ? Number(promo.promo_apr_annual ?? 0) : Number(d.apr_annual ?? 0)
              const isTarget = idx === 0 && d.current_balance_home > 0

              return (
                <div key={d.id} className={`flex items-center gap-4 px-6 py-4 hover:bg-slate-800/20 transition-colors ${isTarget ? 'bg-indigo-500/5 border-l-2 border-l-indigo-500' : ''}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    isTarget ? 'bg-indigo-500/20 text-indigo-400' : 'bg-rose-500/15 text-rose-400'
                  }`}>
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{d.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">{d.debt_type}</span>
                      {promo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400">Promo</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      APR: {apr}%
                      {d.min_payment_home ? ` · Mín: ${formatMoney(Number(d.min_payment_home), d.currency)}` : ''}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-rose-400 tabular-nums">{formatMoney(Number(d.current_balance_home ?? 0), d.currency)}</p>
                    {extra > 0 && (
                      <p className="text-xs text-emerald-400 mt-0.5">+{formatMoney(extra, homeCurrency)} extra</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
              <span className="text-slate-600 text-lg">💳</span>
            </div>
            <p className="text-slate-500 text-sm">Sin deudas activas</p>
            <p className="text-slate-600 text-xs mt-1">Agrega tus deudas para activar el plan {strategy}</p>
          </div>
        )}
      </div>
    </div>
  )
}
