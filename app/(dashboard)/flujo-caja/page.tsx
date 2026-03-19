import { createClient } from '@/utils/supabase/server'
import TransactionForm from '@/components/modules/TransactionForm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ensureUserOnboarding } from '@/lib/actions/onboarding'

function symbolForCurrency(code: string) {
  if (code === 'USD') return '$'
  return '₡'
}

function formatMoney(amount: number, code: string) {
  const symbol = symbolForCurrency(code)
  const n = Number.isFinite(amount) ? amount : 0
  return `${symbol}${n.toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function CashFlowPage() {
  const supabase = await createClient()

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) redirect('/login')

  await ensureUserOnboarding(user.id)

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, currency, account_type')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, level, parent_category_id')
    .eq('user_id', user.id)

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString()

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, occurred_at, description, merchant, amount_home, amount_currency, currency, flow_type, category_level1_id')
    .eq('user_id', user.id)
    .order('occurred_at', { ascending: false })
    .limit(50)

  const { data: settings } = await supabase
    .from('user_settings')
    .select('home_currency')
    .eq('user_id', user.id)
    .single()

  const homeCurrency = String(settings?.home_currency ?? 'CRC')

  const monthTxs = (transactions ?? []).filter((t) => t.occurred_at >= monthStart)
  const incomeTotal = monthTxs.filter((t) => t.flow_type === 'INCOME').reduce((acc, t) => acc + Number(t.amount_home ?? 0), 0)
  const expenseTotal = monthTxs.filter((t) => t.flow_type === 'EXPENSE').reduce((acc, t) => acc + Number(t.amount_home ?? 0), 0)
  const liquidez = incomeTotal - expenseTotal
  const savingsRate = incomeTotal > 0 ? ((incomeTotal - expenseTotal) / incomeTotal) * 100 : 0

  const categoryMap = new Map(
    (categories ?? []).filter((c) => c.level === 1).map((c) => [c.id, c.name])
  )

  const txCount = transactions?.length ?? 0

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white">Flujo de Caja</h1>
          <p className="text-slate-400 mt-1 text-sm">
            {now.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })} — {txCount} transacciones
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ingresos</p>
          <h3 className="text-2xl font-black mt-2 text-emerald-400">{formatMoney(incomeTotal, homeCurrency)}</h3>
        </div>
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gastos</p>
          <h3 className="text-2xl font-black mt-2 text-rose-400">{formatMoney(expenseTotal, homeCurrency)}</h3>
        </div>
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Liquidez neta</p>
          <h3 className={`text-2xl font-black mt-2 ${liquidez >= 0 ? 'text-white' : 'text-rose-400'}`}>
            {formatMoney(liquidez, homeCurrency)}
          </h3>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl sticky top-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Nuevo registro
            </h2>
            <TransactionForm accounts={accounts || []} categories={categories || []} />
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="rounded-2xl bg-slate-900/40 border border-slate-800/50 backdrop-blur-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50">
              <h2 className="text-lg font-bold text-white">Historial reciente</h2>
              <span className="text-xs text-slate-500">{txCount} registros</span>
            </div>

            {transactions && transactions.length > 0 ? (
              <div className="divide-y divide-slate-800/40">
                {transactions.map((t) => {
                  const isIncome = t.flow_type === 'INCOME'
                  const isExpense = t.flow_type === 'EXPENSE'
                  const catName = t.category_level1_id ? categoryMap.get(t.category_level1_id) : null
                  const displayAmount = Number(t.amount_currency ?? t.amount_home ?? 0)
                  const txCurrency = t.currency ?? homeCurrency

                  return (
                    <div key={t.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-800/20 transition-colors">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                        isIncome ? 'bg-emerald-500/15 text-emerald-400' :
                        isExpense ? 'bg-rose-500/15 text-rose-400' :
                        'bg-slate-700/50 text-slate-400'
                      }`}>
                        {isIncome ? '+' : isExpense ? '-' : '↔'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {t.description || t.merchant || 'Sin descripción'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatDate(t.occurred_at)}
                          {catName && <span className="ml-2 text-slate-600">·</span>}
                          {catName && <span className="ml-2 text-indigo-400/70">{catName}</span>}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`text-sm font-semibold tabular-nums ${
                          isIncome ? 'text-emerald-400' : isExpense ? 'text-rose-400' : 'text-slate-300'
                        }`}>
                          {isIncome ? '+' : isExpense ? '-' : ''}{formatMoney(displayAmount, txCurrency)}
                        </p>
                        {txCurrency !== homeCurrency && (
                          <p className="text-[10px] text-slate-600 tabular-nums">
                            ≈ {formatMoney(Number(t.amount_home ?? 0), homeCurrency)}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                  <span className="text-slate-600 text-lg">$</span>
                </div>
                <p className="text-slate-500 text-sm">Sin transacciones aún</p>
                <p className="text-slate-600 text-xs mt-1">Registra tu primera transacción en el formulario</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
