import { createClient } from '@/utils/supabase/server'
import TransactionForm from '@/components/modules/TransactionForm'

function symbolForCurrency(code: string) {
  if (code === 'USD') return '$'
  return '₡'
}

function formatMoney(amount: number, homeCurrency: string) {
  const symbol = symbolForCurrency(homeCurrency)
  const n = Number.isFinite(amount) ? amount : 0
  return `${symbol}${n.toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export default async function CashFlowPage() {
  const supabase = await createClient()

  const { data: settings } = await supabase.from('user_settings').select('home_currency').single()
  const homeCurrency = String(settings?.home_currency ?? 'CRC')

  const { data: accounts } = await supabase.from('accounts').select('id, name, currency, account_type').eq('is_active', true)
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, level, parent_category_id')
    .order('level', { ascending: true })

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString()

  const [incomeRes, expenseRes, txRes] = await Promise.all([
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
      .select('id, occurred_at, flow_type, amount_home, currency, merchant, description, status, external_reference')
      .order('occurred_at', { ascending: false })
      .limit(25),
  ])

  const incomeHome = (incomeRes?.data ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_home ?? 0), 0)
  const expenseHome = (expenseRes?.data ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_home ?? 0), 0)
  const saldoHome = incomeHome - expenseHome

  const transactions = txRes?.data ?? []

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Flujo de Caja</h1>
          <p className="text-slate-400 mt-1">Ledger + Transacciones (base: {homeCurrency}).</p>
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
          <p className="text-[10px] text-slate-500 mt-2">Mes actual (UTC)</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              Nuevo Asiento
            </h2>
            <TransactionForm accounts={accounts ?? []} categories={categories ?? []} />
          </div>
        </div>

        <div className="lg:col-span-8 bg-slate-900/20 border border-slate-800/50 rounded-3xl p-8 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold">Registros Recientes</h2>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Últimos 25
            </span>
          </div>

          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
              <p className="text-slate-600 text-sm italic">Esperando primera transacción...</p>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="pb-3 pr-4">Fecha</th>
                    <th className="pb-3 pr-4">Tipo</th>
                    <th className="pb-3 pr-4">Comercio</th>
                    <th className="pb-3 pr-4">Detalle</th>
                    <th className="pb-3 pr-4">Monto (home)</th>
                    <th className="pb-3 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {transactions.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 pr-4 text-slate-200">
                        {t.occurred_at ? new Date(t.occurred_at).toLocaleDateString('es-CR') : '—'}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={
                            t.flow_type === 'INCOME'
                              ? 'text-emerald-400'
                              : t.flow_type === 'EXPENSE'
                                ? 'text-rose-400'
                                : 'text-indigo-300'
                          }
                        >
                          {t.flow_type ?? '—'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-300">{t.merchant ?? '—'}</td>
                      <td className="py-3 pr-4 text-slate-400 max-w-[240px]">{t.description ?? '—'}</td>
                      <td className="py-3 pr-4 text-slate-200 whitespace-nowrap">
                        {formatMoney(Number(t.amount_home ?? 0), homeCurrency)}
                      </td>
                      <td className="py-3 pr-4 text-slate-400">{t.status ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

