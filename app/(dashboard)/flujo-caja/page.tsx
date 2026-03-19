import { createClient } from '@/utils/supabase/server'
import TransactionForm from '@/components/modules/TransactionForm'
import { redirect } from 'next/navigation'

export default async function CashFlowPage() {
  const supabase = await createClient()
  
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const { data: accounts } = await supabase.from('accounts').select('id, name, currency, account_type')
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, level, parent_category_id')

  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount_home, currency, flow_type')

  // Cálculos rápidos para los KPIs (aprox): ingresos - gastos por moneda
  const balanceCRC =
    transactions?.filter((t) => t.currency === 'CRC').reduce((acc, t) => acc + (t.flow_type === 'INCOME' ? Number(t.amount_home) : -Number(t.amount_home)), 0) || 0

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      {/* Header Informativo */}
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

      {/* 📈 KPI SECTION */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="relative group overflow-hidden p-8 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-indigo-500/50 transition-all shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <div className="w-12 h-12 rounded-full border-4 border-white" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Liquidez Total (CRC)</p>
          <h3 className="text-4xl font-black mt-3 text-white">₡{balanceCRC.toLocaleString()}</h3>
        </div>

        <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 shadow-2xl">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tasa de Ahorro</p>
          <div className="mt-4 h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 w-[15%]" />
          </div>
          <p className="text-[10px] text-slate-500 mt-2 font-medium italic">Proyección basada en ingresos vs egresos</p>
        </div>

        <div className="p-8 rounded-3xl bg-gradient-to-br from-indigo-600/20 to-cyan-600/20 border border-indigo-500/30 shadow-2xl backdrop-blur-md">
          <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Optimización Cloud</p>
          <h3 className="text-lg font-bold mt-3 text-white">Modo FinOps Activo</h3>
          <p className="text-xs text-indigo-200/60 mt-1">Listo para análisis de varianza.</p>
        </div>
      </section>

      {/* 🛠️ ACCIONES Y TABLA */}
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
              <button className="text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest">Ver todo &rarr;</button>
           </div>
           
           <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
              <p className="text-slate-600 text-sm italic">Esperando primera transacción...</p>
           </div>
        </div>
      </div>
    </div>
  )
}