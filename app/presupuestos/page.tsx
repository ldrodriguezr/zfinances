import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ensureUserOnboarding } from '@/lib/actions/onboarding'
import CrearPresupuestoButton from '@/components/modules/CrearPresupuestoButton'
import BudgetLineEditor from '@/components/modules/BudgetLineEditor'

function formatMoney(amount: number) {
  return `₡${Number(amount).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default async function PresupuestosPage() {
  const supabase = await createClient()

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) redirect('/login')

  await ensureUserOnboarding(user.id)

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0))
  const monthStartYMD = monthStart.toISOString().slice(0, 10)
  const monthLabel = monthStart.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })

  const { data: budget } = await supabase
    .from('monthly_budgets')
    .select('id, month_start, income_total_home, available_home, currency, status')
    .eq('user_id', user.id)
    .eq('month_start', monthStartYMD)
    .maybeSingle()

  const { data: lines } = budget
    ? await supabase
        .from('budget_lines')
        .select('id, category_level1_id, budget_amount_home, spent_amount_home, execution_pct')
        .eq('budget_id', budget.id)
    : { data: [] }

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', user.id)
    .eq('level', 1)

  const categoryMap = new Map((categories ?? []).map((c) => [c.id, c.name]))

  const totalBudgeted = (lines ?? []).reduce((acc, l) => acc + Number(l.budget_amount_home ?? 0), 0)
  const totalSpent = (lines ?? []).reduce((acc, l) => acc + Number(l.spent_amount_home ?? 0), 0)
  const totalExecution = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0

  const { data: sinkingFunds } = await supabase
    .from('sinking_funds')
    .select('id, name, annual_target_home, contribution_monthly_home, target_month, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white">Presupuestos</h1>
          <p className="text-slate-400 mt-1 text-sm">Zero-Based Budgeting — {monthLabel}</p>
        </div>
      </header>

      {budget ? (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ingresos del mes</p>
              <h3 className="text-2xl font-black mt-2 text-emerald-400">{formatMoney(Number(budget.income_total_home ?? 0))}</h3>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Presupuestado</p>
              <h3 className="text-2xl font-black mt-2 text-white">{formatMoney(totalBudgeted)}</h3>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gastado</p>
              <h3 className="text-2xl font-black mt-2 text-rose-400">{formatMoney(totalSpent)}</h3>
            </div>
            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-600/20 to-cyan-600/20 border border-indigo-500/30">
              <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Ejecución global</p>
              <h3 className="text-2xl font-black mt-2 text-white">{totalExecution.toFixed(1)}%</h3>
              <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${totalExecution >= 100 ? 'bg-rose-500' : totalExecution >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, totalExecution)}%` }}
                />
              </div>
            </div>
          </section>

          <div className="rounded-2xl bg-slate-900/40 border border-slate-800/50 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50">
              <h2 className="text-lg font-bold text-white">Límites por categoría</h2>
              <p className="text-xs text-slate-500">Click en el monto para editar</p>
            </div>
            {lines && lines.length > 0 ? (
              <div className="divide-y divide-slate-800/40">
                {lines.map((line: any) => {
                  const catName = categoryMap.get(line.category_level1_id) ?? 'Sin categoría'
                  return (
                    <BudgetLineEditor
                      key={line.id}
                      lineId={line.id}
                      categoryName={catName}
                      currentAmount={Number(line.budget_amount_home ?? 0)}
                      spentAmount={Number(line.spent_amount_home ?? 0)}
                      executionPct={Number(line.execution_pct ?? 0)}
                    />
                  )
                })}
              </div>
            ) : (
              <p className="text-slate-500 italic p-6">No hay líneas de presupuesto.</p>
            )}
          </div>

          {sinkingFunds && sinkingFunds.length > 0 && (
            <div className="rounded-2xl bg-slate-900/40 border border-slate-800/50 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800/50">
                <h2 className="text-lg font-bold text-white">Sinking Funds</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 p-6">
                {sinkingFunds.map((f: any) => (
                  <div key={f.id} className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                    <p className="font-medium text-white">{f.name}</p>
                    <p className="text-sm text-slate-400 mt-1">
                      Meta: {formatMoney(Number(f.annual_target_home ?? 0))} · Aporte: {formatMoney(Number(f.contribution_monthly_home ?? 0))}/mes
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl bg-slate-900/40 border border-dashed border-slate-700">
          <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mb-4">
            <span className="text-2xl text-slate-600">📊</span>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            No hay presupuesto para <span className="text-white font-medium">{monthLabel}</span>
          </p>
          <CrearPresupuestoButton monthStartYMD={monthStartYMD} monthLabel={monthLabel} />
        </div>
      )}
    </div>
  )
}
