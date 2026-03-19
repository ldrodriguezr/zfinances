import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ensureUserOnboarding } from '@/lib/actions/onboarding'
import { planExtraPaymentsToDebts } from '@/lib/debt/debt'

function formatMoney(amount: number, currency: string = 'CRC') {
  const sym = currency === 'USD' ? '$' : '₡'
  return `${sym}${Number(amount).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
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

  const promoMap = new Map(
    (promos ?? []).map((p: any) => [p.debt_id, p])
  )

  const totalDeuda = (debts ?? []).reduce((acc, d) => acc + Number(d.current_balance_home ?? 0), 0)

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const incomeRes = await supabase
    .from('transactions')
    .select('amount_home')
    .eq('flow_type', 'INCOME')
    .gte('occurred_at', monthStart.toISOString())
  const expenseRes = await supabase
    .from('transactions')
    .select('amount_home')
    .eq('flow_type', 'EXPENSE')
    .gte('occurred_at', monthStart.toISOString())

  const income = (incomeRes.data ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_home ?? 0), 0)
  const expense = (expenseRes.data ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_home ?? 0), 0)
  const surplus = income - expense

  let plan: Array<{ debtId: string; amountHome: number }> = []
  if (surplus > 0) {
    try {
      plan = await planExtraPaymentsToDebts({
        userId: user.id,
        surplusHome: surplus,
        strategy,
        asOfISO: now.toISOString(),
      })
    } catch {
      plan = []
    }
  }

  const planMap = new Map(plan.map((p) => [p.debtId, p.amountHome]))

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Deudas (Snowball)</h1>
          <p className="text-slate-400 mt-1">Estrategia: {strategy}. Próximos pagos extra según surplus.</p>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Deuda total</p>
          <h3 className="text-3xl font-black mt-3 text-rose-400">{formatMoney(totalDeuda, homeCurrency)}</h3>
        </div>
        <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Surplus del mes</p>
          <h3 className="text-3xl font-black mt-3 text-emerald-400">{formatMoney(surplus, homeCurrency)}</h3>
        </div>
        <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Estrategia</p>
          <h3 className="text-lg font-bold mt-3 text-slate-300">{strategy}</h3>
        </div>
      </section>

      <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
        <h2 className="text-xl font-bold mb-6">Lista de deudas</h2>
        {debts && debts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="pb-3 font-medium">Deuda</th>
                  <th className="pb-3 font-medium">Tipo</th>
                  <th className="pb-3 font-medium text-right">Balance</th>
                  <th className="pb-3 font-medium text-right">APR</th>
                  <th className="pb-3 font-medium text-right">Pago extra sugerido</th>
                </tr>
              </thead>
              <tbody>
                {debts.map((d: any) => {
                  const promo = promoMap.get(d.id)
                  const extra = planMap.get(d.id) ?? 0
                  return (
                    <tr key={d.id} className="border-b border-slate-800/50">
                      <td className="py-3 text-white font-medium">{d.name}</td>
                      <td className="py-3 text-slate-400 text-xs uppercase">{d.debt_type}</td>
                      <td className="py-3 text-right text-rose-400">{formatMoney(Number(d.current_balance_home ?? 0), d.currency)}</td>
                      <td className="py-3 text-right text-slate-300">
                        {promo ? (
                          <span className="text-emerald-400">{promo.promo_apr_annual}% (promo)</span>
                        ) : (
                          `${Number(d.apr_annual ?? 0)}%`
                        )}
                      </td>
                      <td className="py-3 text-right text-emerald-400">{extra > 0 ? formatMoney(extra, homeCurrency) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 italic">No hay deudas activas. Agrega deudas para ver el plan Snowball/Avalanche.</p>
        )}
      </div>
    </div>
  )
}
