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
  return `${symbol}${n.toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default async function ControlPanelPage() {
  const supabase = await createClient()

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) redirect('/login')

  await ensureUserOnboarding(user.id)

  const { data: settings } = await supabase
    .from('user_settings')
    .select('home_currency, debt_strategy')
    .single()

  const homeCurrency = String(settings?.home_currency ?? 'CRC')
  const strategy = (settings?.debt_strategy as 'SNOWBALL' | 'AVALANCHE') ?? 'AVALANCHE'

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString()
  const monthLabel = now.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })

  const [incomeRes, expenseRes, expenseByCatRes, debtsRes, assetsRes, accountsRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount_home')
      .eq('user_id', user.id)
      .eq('flow_type', 'INCOME')
      .eq('status', 'PROCESSED')
      .gte('occurred_at', monthStart),
    supabase
      .from('transactions')
      .select('amount_home')
      .eq('user_id', user.id)
      .eq('flow_type', 'EXPENSE')
      .eq('status', 'PROCESSED')
      .gte('occurred_at', monthStart),
    supabase
      .from('transactions')
      .select('amount_home, category_level1_id')
      .eq('user_id', user.id)
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
    supabase
      .from('accounts')
      .select('id, name, account_type, currency')
      .eq('user_id', user.id)
      .eq('is_active', true),
  ])

  const incomeHome = (incomeRes.data ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_home ?? 0), 0)
  const expenseHome = (expenseRes.data ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_home ?? 0), 0)
  const saldoHome = incomeHome - expenseHome
  const savingsRate = incomeHome > 0 ? ((incomeHome - expenseHome) / incomeHome) * 100 : 0

  const categorySums = new Map<string, number>()
  for (const r of expenseByCatRes.data ?? []) {
    const catId = r.category_level1_id ?? 'sin_categoria'
    categorySums.set(catId, (categorySums.get(catId) ?? 0) + Number(r.amount_home ?? 0))
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', user.id)
    .eq('level', 1)
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
  const totalDeuda = debts.reduce((acc, d) => acc + d.balance, 0)
  const orderedDebts =
    strategy === 'SNOWBALL'
      ? [...debts].filter((d) => d.balance > 0).sort((a, b) => a.balance - b.balance)
      : [...debts].filter((d) => d.balance > 0).sort((a, b) => b.apr - a.apr)
  const proximaDeuda = orderedDebts[0]

  let plan: Array<{ debtId: string; amountHome: number }> = []
  if (saldoHome > 0) {
    try {
      plan = await planExtraPaymentsToDebts({ userId: user.id, surplusHome: saldoHome, strategy, asOfISO: now.toISOString() })
    } catch { plan = [] }
  }
  const proximaDeudaExtra = proximaDeuda ? plan.find((p) => p.debtId === proximaDeuda.id)?.amountHome ?? 0 : 0

  let assetsTotal = 0
  for (const a of assetsRes.data ?? []) {
    const pv = Number(a.purchase_value ?? 0)
    const rate = Number(a.depreciation_rate_annual ?? 0)
    const pd = new Date(a.purchase_date)
    const months = Math.max(0, (now.getUTCFullYear() - pd.getUTCFullYear()) * 12 + (now.getUTCMonth() - pd.getUTCMonth()))
    const dep = pv * rate * (months / 12)
    const res = a.residual_value_home != null ? Number(a.residual_value_home) : 0
    assetsTotal += Math.max(pv - dep, res)
  }
  const netWorth = assetsTotal - totalDeuda
  const accountCount = (accountsRes.data ?? []).length

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white">Panel de Control</h1>
          <p className="text-slate-400 mt-1 text-sm">
            {monthLabel} — {accountCount} cuentas activas
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ingresos</p>
          <h3 className="text-2xl font-black mt-2 text-emerald-400">{formatMoney(incomeHome, homeCurrency)}</h3>
          <p className="text-[10px] text-slate-600 mt-1">mes actual</p>
        </div>
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gastos</p>
          <h3 className="text-2xl font-black mt-2 text-rose-400">{formatMoney(expenseHome, homeCurrency)}</h3>
          <p className="text-[10px] text-slate-600 mt-1">mes actual</p>
        </div>
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Saldo neto</p>
          <h3 className={`text-2xl font-black mt-2 ${saldoHome >= 0 ? 'text-white' : 'text-rose-400'}`}>
            {formatMoney(saldoHome, homeCurrency)}
          </h3>
          <p className="text-[10px] text-slate-600 mt-1">ingresos − gastos</p>
        </div>
        <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-600/20 to-cyan-600/20 border border-indigo-500/30">
          <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Tasa de ahorro</p>
          <h3 className="text-2xl font-black mt-2 text-white">{savingsRate.toFixed(1)}%</h3>
          <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/40 border border-slate-800/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800/50">
            <h2 className="text-lg font-bold text-white">Gastos por categoría</h2>
          </div>
          <div className="p-6">
            {pieData.length > 0 ? (
              <ExpensePieChart data={pieData} />
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-slate-500 text-sm">Sin gastos este mes</p>
                <Link href="/flujo-caja" className="text-xs text-indigo-400 hover:text-indigo-300 mt-2">
                  Registrar transacciones →
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900/40 border border-slate-800/50 p-6">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Próxima deuda ({strategy})</h2>
            {proximaDeuda ? (
              <div>
                <p className="text-white font-medium">{proximaDeuda.name}</p>
                <p className="text-xl font-black text-rose-400 mt-1">{formatMoney(proximaDeuda.balance, homeCurrency)}</p>
                <p className="text-xs text-slate-500 mt-1">APR: {proximaDeuda.apr}%</p>
                {proximaDeudaExtra > 0 && (
                  <p className="text-xs text-emerald-400 mt-2">Pago extra sugerido: {formatMoney(proximaDeudaExtra, homeCurrency)}</p>
                )}
                <Link href="/deudas" className="text-xs text-indigo-400 hover:text-indigo-300 mt-3 inline-block">
                  Ver plan completo →
                </Link>
              </div>
            ) : (
              <p className="text-slate-500 text-sm italic">Sin deudas activas</p>
            )}
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-indigo-600/10 to-cyan-600/10 border border-indigo-500/20 p-6">
            <h2 className="text-sm font-bold text-indigo-300 uppercase tracking-widest mb-3">Patrimonio neto</h2>
            <p className={`text-xl font-black ${netWorth >= 0 ? 'text-white' : 'text-rose-400'}`}>
              {formatMoney(netWorth, homeCurrency)}
            </p>
            <p className="text-xs text-indigo-200/50 mt-1">
              Activos {formatMoney(assetsTotal, homeCurrency)} − Pasivos {formatMoney(totalDeuda, homeCurrency)}
            </p>
            <Link href="/patrimonio-neto" className="text-xs text-indigo-400 hover:text-indigo-300 mt-3 inline-block">
              Ver detalle →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
