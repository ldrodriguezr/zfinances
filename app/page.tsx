import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ensureUserOnboarding } from '@/lib/actions/onboarding'
import { planExtraPaymentsToDebts } from '@/lib/debt/debt'
import ExpensePieChart from '@/components/modules/ExpensePieChart'

function symbolForCurrency(code: string) {
  if (code === 'USD') return '$'
  return '₡'
}

function formatMoney(amount: number, code: string) {
  const symbol = symbolForCurrency(code)
  const n = Number.isFinite(amount) ? amount : 0
  return `${symbol}${n.toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export default async function ControlPanelPage() {
  const supabase = await createClient()

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user

  if (!user) {
    redirect('/login')
  }

  await ensureUserOnboarding(user.id)

  const { data: settings } = await supabase
    .from('user_settings')
    .select('home_currency, debt_strategy')
    .single()

  const homeCurrency = String(settings?.home_currency ?? 'CRC')
  const strategy = (settings?.debt_strategy as 'SNOWBALL' | 'AVALANCHE') ?? 'AVALANCHE'

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString()

  const [incomeRes, expenseRes, expenseByCatRes, debtsRes, assetsRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount_home')
      .eq('flow_type', 'INCOME')
      .eq('status', 'PROCESSED')
      .gte('occurred_at', monthStart),
    supabase
      .from('transactions')
      .select('amount_home')
      .eq('flow_type', 'EXPENSE')
      .eq('status', 'PROCESSED')
      .gte('occurred_at', monthStart),
    supabase
      .from('transactions')
      .select('amount_home, category_level1_id')
      .eq('flow_type', 'EXPENSE')
      .eq('status', 'PROCESSED')
      .gte('occurred_at', monthStart),
    supabase
      .from('debts')
      .select('id, name, current_balance_home, apr_annual')
      .eq('user_id', user.id)
      .eq('is_active', true),
    supabase
      .from('assets')
      .select('purchase_value, depreciation_rate_annual, purchase_date, residual_value_home')
      .eq('user_id', user.id)
      .eq('is_active', true),
  ])

  const incomeHome = (incomeRes.data ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_home ?? 0), 0)
  const expenseHome = (expenseRes.data ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_home ?? 0), 0)
  const saldoHome = incomeHome - expenseHome

  const categorySums = new Map<string, number>()
  for (const r of expenseByCatRes.data ?? []) {
    const catId = r.category_level1_id ?? 'sin_categoria'
    categorySums.set(catId, (categorySums.get(catId) ?? 0) + Number(r.amount_home ?? 0))
  }

  const { data: categories } = await supabase.from('categories').select('id, name').eq('level', 1)
  const categoryMap = new Map((categories ?? []).map((c) => [c.id, c.name]))

  const pieData = Array.from(categorySums.entries()).map(([catId, value]) => ({
    name: categoryMap.get(catId) ?? (catId === 'sin_categoria' ? 'Sin categoría' : catId),
    value: Math.round(value * 100) / 100,
  }))

  const debts = (debtsRes.data ?? []).map((d: any) => ({
    id: d.id,
    name: d.name,
    balance: Number(d.current_balance_home ?? 0),
    apr: Number(d.apr_annual ?? 0),
  }))
  const orderedDebts =
    strategy === 'SNOWBALL'
      ? [...debts].filter((d) => d.balance > 0).sort((a, b) => a.balance - b.balance)
      : [...debts].filter((d) => d.balance > 0).sort((a, b) => b.apr - a.apr)
  const proximaDeuda = orderedDebts.find((d) => d.balance > 0)

  const surplus = incomeHome - expenseHome
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
  const proximaDeudaExtra = proximaDeuda ? plan.find((p) => p.debtId === proximaDeuda.id)?.amountHome ?? 0 : 0

  let assetsTotal = 0
  for (const a of assetsRes.data ?? []) {
    const pv = Number(a.purchase_value ?? 0)
    const rate = Number(a.depreciation_rate_annual ?? 0)
    const pd = new Date(a.purchase_date)
    const months = Math.max(
      0,
      (now.getUTCFullYear() - pd.getUTCFullYear()) * 12 + (now.getUTCMonth() - pd.getUTCMonth())
    )
    const dep = pv * rate * (months / 12)
    const res = a.residual_value_home != null ? Number(a.residual_value_home) : 0
    assetsTotal += Math.max(pv - dep, res)
  }
  const liabilitiesTotal = debts.reduce((acc, d) => acc + d.balance, 0)
  const netWorth = assetsTotal - liabilitiesTotal

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Panel de Control</h1>
          <p className="text-slate-400 mt-1">Resumen ejecutivo — mes actual (UTC).</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full uppercase tracking-widest border border-emerald-500/20">
            En Línea • Supabase Sync
          </span>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="relative group overflow-hidden p-8 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-indigo-500/50 transition-all shadow-2xl">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Saldo</p>
          <h3 className="text-4xl font-black mt-3 text-white">{formatMoney(saldoHome, homeCurrency)}</h3>
          <p className="text-[10px] text-slate-500 mt-2">Ingresos - Gastos (home)</p>
        </div>

        <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 shadow-2xl">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ingresos</p>
          <h3 className="text-4xl font-black mt-3 text-white">{formatMoney(incomeHome, homeCurrency)}</h3>
          <p className="text-[10px] text-slate-500 mt-2">Ejecutado este mes</p>
        </div>

        <div className="p-8 rounded-3xl bg-gradient-to-br from-indigo-600/20 to-cyan-600/20 border border-indigo-500/30 shadow-2xl backdrop-blur-md">
          <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Gastos</p>
          <h3 className="text-4xl font-black mt-3 text-white">{formatMoney(expenseHome, homeCurrency)}</h3>
          <p className="text-[10px] text-indigo-200/60 mt-2">Ejecutado este mes</p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
          <h2 className="text-xl font-bold mb-6">Gastos por categoría</h2>
          <ExpensePieChart data={pieData} />
        </div>

        <div className="space-y-6">
          <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
            <h2 className="text-lg font-bold mb-4">Próxima deuda a pagar</h2>
            {proximaDeuda ? (
              <div>
                <p className="text-white font-medium">{proximaDeuda.name}</p>
                <p className="text-2xl font-black text-rose-400 mt-2">{formatMoney(proximaDeuda.balance, homeCurrency)}</p>
                {proximaDeudaExtra > 0 && (
                  <p className="text-sm text-emerald-400 mt-2">Pago extra sugerido: {formatMoney(proximaDeudaExtra, homeCurrency)}</p>
                )}
                <Link href="/deudas" className="text-xs text-indigo-400 hover:text-indigo-300 mt-2 inline-block">
                  Ver plan completo →
                </Link>
              </div>
            ) : (
              <p className="text-slate-500 italic">Sin deudas activas</p>
            )}
          </div>

          <div className="p-8 rounded-3xl bg-gradient-to-br from-indigo-600/20 to-cyan-600/20 border border-indigo-500/30">
            <h2 className="text-lg font-bold mb-4">Patrimonio neto</h2>
            <p className="text-3xl font-black text-white">{formatMoney(netWorth, homeCurrency)}</p>
            <p className="text-xs text-indigo-200/60 mt-2">Activos - Pasivos</p>
            <Link href="/patrimonio-neto" className="text-xs text-indigo-400 hover:text-indigo-300 mt-2 inline-block">
              Ver detalle →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
