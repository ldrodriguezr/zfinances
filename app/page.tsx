import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

function symbolForCurrency(code: string) {
  if (code === 'USD') return '$'
  return '₡'
}

function formatMoney(amount: number, code: string) {
  const symbol = symbolForCurrency(code)
  const n = Number.isFinite(amount) ? amount : 0
  // Para CRC/moneda base se usa el símbolo; separador depende del runtime.
  return `${symbol}${n.toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export default async function ControlPanelPage() {
  const supabase = await createClient()

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user

  if (!user) {
    redirect('/login')
  }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('home_currency')
    .single()

  const homeCurrency = String(settings?.home_currency ?? 'CRC')

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString()

  const [incomeRes, expenseRes] = await Promise.all([
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
  ])

  const incomeHome = (incomeRes.data ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_home ?? 0), 0)
  const expenseHome = (expenseRes.data ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_home ?? 0), 0)
  const saldoHome = incomeHome - expenseHome

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Panel de Control</h1>
          <p className="text-slate-400 mt-1">KPI de tu mes actual (UTC) en tu moneda base.</p>
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
    </div>
  )
}
