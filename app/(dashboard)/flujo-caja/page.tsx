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
  return new Date(iso).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default async function CashFlowPage() {
  const supabase = await createClient()

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) redirect('/login')

  await ensureUserOnboarding(user.id)

  const { data: accounts } = await supabase.from('accounts').select('id, name, currency, account_type')
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, level, parent_category_id')

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, occurred_at, description, merchant, amount_home, currency, flow_type')
    .order('occurred_at', { ascending: false })
    .limit(50)

  const { data: settings } = await supabase
    .from('user_settings')
    .select('home_currency')
    .eq('user_id', user.id)
    .single()

  const homeCurrency = String(settings?.home_currency ?? 'CRC')

  const incomeTotal = (transactions ?? [])
    .filter((t) => t.flow_type === 'INCOME')
    .reduce((acc, t) => acc + Number(t.amount_home ?? 0), 0)
  const expenseTotal = (transactions ?? [])
    .filter((t) => t.flow_type === 'EXPENSE')
    .reduce((acc, t) => acc + Number(t.amount_home ?? 0), 0)

  const liquidezTotal = incomeTotal - expenseTotal
  const tasaAhorro = incomeTotal > 0 ? Math.max(0, ((incomeTotal - expenseTotal) / incomeTotal) * 100) : 0

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Flujo de Caja</h1>
          <p className="text-slate-400 mt-1">Monitoreo dinámico del esquema personal_finance.</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full uppercase tracking-widest border border-emerald-500/20">
            En Línea • Supabase Sync
          </span>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="relative group overflow-hidden p-8 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-indigo-500/50 transition-all shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <div className="w-12 h-12 rounded-full border-4 border-white" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Liquidez Total ({homeCurrency})</p>
          <h3 className="text-4xl font-black mt-3 text-white">{formatMoney(liquidezTotal, homeCurrency)}</h3>
        </div>

        <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 shadow-2xl">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tasa de Ahorro</p>
          <div className="mt-4 h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: `${Math.min(100, tasaAhorro)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-2 font-medium italic">
            {tasaAhorro.toFixed(1)}% — Proyección basada en ingresos vs egresos
          </p>
        </div>

        <div className="p-8 rounded-3xl bg-gradient-to-br from-indigo-600/20 to-cyan-600/20 border border-indigo-500/30 shadow-2xl backdrop-blur-md">
          <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Optimización Cloud</p>
          <h3 className="text-lg font-bold mt-3 text-white">Modo FinOps Activo</h3>
          <p className="text-xs text-indigo-200/60 mt-1">Listo para análisis de varianza.</p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              Nuevo Asiento
            </h2>
            <TransactionForm accounts={accounts || []} categories={categories || []} />
          </div>
        </div>

        <div className="lg:col-span-8 bg-slate-900/20 border border-slate-800/50 rounded-3xl p-8 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold">Historial Reciente</h2>
            <Link
              href="/flujo-caja"
              className="text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest"
            >
              Ver todo &rarr;
            </Link>
          </div>

          {transactions && transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="pb-3 font-medium">Fecha</th>
                    <th className="pb-3 font-medium">Descripción</th>
                    <th className="pb-3 font-medium text-right">Monto</th>
                    <th className="pb-3 font-medium">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="py-3 text-slate-300">{formatDate(t.occurred_at)}</td>
                      <td className="py-3 text-white">{t.description || t.merchant || '—'}</td>
                      <td
                        className={`py-3 text-right font-medium ${
                          t.flow_type === 'INCOME' ? 'text-emerald-400' : t.flow_type === 'EXPENSE' ? 'text-rose-400' : 'text-slate-300'
                        }`}
                      >
                        {t.flow_type === 'INCOME' ? '+' : t.flow_type === 'EXPENSE' ? '-' : ''}
                        {formatMoney(Number(t.amount_home ?? 0), t.currency ?? homeCurrency)}
                      </td>
                      <td className="py-3 text-slate-500 text-xs uppercase">
                        {t.flow_type === 'INCOME' ? 'Ingreso' : t.flow_type === 'EXPENSE' ? 'Gasto' : 'Transferencia'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
              <p className="text-slate-600 text-sm italic">Esperando primera transacción...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
