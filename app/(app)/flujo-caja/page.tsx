import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import TransactionForm from '@/components/modules/TransactionForm'
import TransactionRow from '@/components/modules/TransactionRow'
import { ensureUserOnboarding } from '@/lib/actions/onboarding'

function formatMoney(amount: number, code: string) {
  const sym = code === 'USD' ? '$' : '₡'
  return `${sym}${Number(amount).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default async function CashFlowPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) redirect('/login')

  await ensureUserOnboarding(user.id)

  const [accountsRes, categoriesRes, settingsRes] = await Promise.all([
    supabase.from('accounts').select('id, name, currency, account_type').eq('user_id', user.id).eq('is_active', true),
    supabase.from('categories').select('id, name, level, parent_category_id').eq('user_id', user.id),
    supabase.from('user_settings').select('home_currency').eq('user_id', user.id).single(),
  ])

  const accounts = accountsRes.data ?? []
  const categories = categoriesRes.data ?? []
  const homeCurrency = String(settingsRes.data?.home_currency ?? 'CRC')

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, occurred_at, description, merchant, amount_home, amount_currency, currency, flow_type, category_level1_id')
    .eq('user_id', user.id)
    .order('occurred_at', { ascending: false })
    .limit(100)

  const monthTxs = (transactions ?? []).filter((t) => t.occurred_at >= monthStart)
  const incomeTotal = monthTxs.filter((t) => t.flow_type === 'INCOME').reduce((s, t) => s + Number(t.amount_home ?? 0), 0)
  const expenseTotal = monthTxs.filter((t) => t.flow_type === 'EXPENSE').reduce((s, t) => s + Number(t.amount_home ?? 0), 0)
  const net = incomeTotal - expenseTotal
  const savingsRate = incomeTotal > 0 ? ((incomeTotal - expenseTotal) / incomeTotal) * 100 : 0

  const l1Categories = categories.filter((c) => c.level === 1)
  const categoryMap = new Map(l1Categories.map((c) => [c.id, c.name]))

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Flujo de Caja</h1>
        <p className="text-slate-400 mt-1 text-sm">
          {now.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })} — {(transactions ?? []).length} transacciones
        </p>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ingresos</p>
          <p className="text-xl font-black mt-1.5 text-emerald-400">{formatMoney(incomeTotal, homeCurrency)}</p>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gastos</p>
          <p className="text-xl font-black mt-1.5 text-rose-400">{formatMoney(expenseTotal, homeCurrency)}</p>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Neto</p>
          <p className={`text-xl font-black mt-1.5 ${net >= 0 ? 'text-white' : 'text-rose-400'}`}>{formatMoney(net, homeCurrency)}</p>
        </div>
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-600/15 to-cyan-600/15 border border-indigo-500/20">
          <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Ahorro</p>
          <p className="text-xl font-black mt-1.5 text-white">{savingsRate.toFixed(1)}%</p>
          <div className="mt-1.5 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400" style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl sticky top-6">
            <h2 className="text-base font-bold mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Nuevo registro
            </h2>
            <TransactionForm accounts={accounts} categories={categories} />
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="rounded-2xl bg-slate-900/40 border border-slate-800/50 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/50">
              <h2 className="text-base font-bold text-white">Transacciones</h2>
              <span className="text-xs text-slate-500">{(transactions ?? []).length} registros</span>
            </div>

            {transactions && transactions.length > 0 ? (
              <div className="divide-y divide-slate-800/30">
                {transactions.map((t: any) => (
                  <TransactionRow
                    key={t.id}
                    tx={t}
                    homeCurrency={homeCurrency}
                    categoryName={t.category_level1_id ? categoryMap.get(t.category_level1_id) ?? null : null}
                    categories={l1Categories}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <p className="text-slate-500 text-sm">Sin transacciones</p>
                <p className="text-slate-600 text-xs mt-1">Registra tu primera transacción</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
