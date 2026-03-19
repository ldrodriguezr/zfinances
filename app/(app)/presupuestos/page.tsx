import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ensureUserOnboarding } from '@/lib/actions/onboarding'
import CrearPresupuestoButton from '@/components/modules/CrearPresupuestoButton'
import BudgetLineEditor from '@/components/modules/BudgetLineEditor'
import SinkingFundCard from '@/components/modules/SinkingFundCard'
import AgregarSinkingFundButton from '@/components/modules/AgregarSinkingFundButton'

function formatMoney(n: number) {
  return `₡${Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default async function PresupuestosPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) redirect('/login')

  await ensureUserOnboarding(user.id)

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const monthStartYMD = monthStart.toISOString().slice(0, 10)
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  const monthLabel = monthStart.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })

  // Auto-calculate real income/expense from transactions
  const [incRes, expRes] = await Promise.all([
    supabase.from('transactions').select('amount_home').eq('user_id', user.id).eq('flow_type', 'INCOME').gte('occurred_at', monthStartYMD).lt('occurred_at', monthEnd.toISOString()),
    supabase.from('transactions').select('amount_home').eq('user_id', user.id).eq('flow_type', 'EXPENSE').gte('occurred_at', monthStartYMD).lt('occurred_at', monthEnd.toISOString()),
  ])
  const realIncome = (incRes.data ?? []).reduce((s: number, r: any) => s + Number(r.amount_home ?? 0), 0)
  const realExpense = (expRes.data ?? []).reduce((s: number, r: any) => s + Number(r.amount_home ?? 0), 0)

  const { data: budget } = await supabase
    .from('monthly_budgets')
    .select('id, income_total_home, available_home, status')
    .eq('user_id', user.id).eq('month_start', monthStartYMD).maybeSingle()

  // Auto-update budget income from real transactions
  if (budget && Number(budget.income_total_home) !== realIncome) {
    await supabase.from('monthly_budgets').update({ income_total_home: realIncome, available_home: realIncome - realExpense }).eq('id', budget.id)
    budget.income_total_home = realIncome
    budget.available_home = realIncome - realExpense
  }

  const { data: lines } = budget
    ? await supabase.from('budget_lines').select('id, category_level1_id, budget_amount_home, spent_amount_home, execution_pct').eq('budget_id', budget.id)
    : { data: [] }

  const { data: categories } = await supabase.from('categories').select('id, name').eq('user_id', user.id).eq('level', 1)
  const categoryMap = new Map((categories ?? []).map((c) => [c.id, c.name]))

  const totalBudgeted = (lines ?? []).reduce((s, l) => s + Number(l.budget_amount_home ?? 0), 0)
  const totalSpent = (lines ?? []).reduce((s, l) => s + Number(l.spent_amount_home ?? 0), 0)
  const execPct = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0

  const { data: sinkingFunds } = await supabase
    .from('sinking_funds')
    .select('id, name, annual_target_home, contribution_monthly_home, target_month')
    .eq('user_id', user.id).eq('is_active', true)

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Presupuestos</h1>
        <p className="text-slate-400 mt-1 text-sm">Zero-Based Budgeting — {monthLabel}</p>
      </header>

      {budget ? (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ingresos reales</p>
              <p className="text-xl font-black mt-1.5 text-emerald-400">{formatMoney(realIncome)}</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Presupuestado</p>
              <p className="text-xl font-black mt-1.5 text-white">{formatMoney(totalBudgeted)}</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gastado real</p>
              <p className="text-xl font-black mt-1.5 text-rose-400">{formatMoney(realExpense)}</p>
            </div>
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-600/15 to-cyan-600/15 border border-indigo-500/20">
              <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Ejecución</p>
              <p className="text-xl font-black mt-1.5 text-white">{execPct.toFixed(0)}%</p>
              <div className="mt-1.5 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full transition-all ${execPct >= 100 ? 'bg-rose-500' : execPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, execPct)}%` }} />
              </div>
            </div>
          </section>

          <div className="rounded-2xl bg-slate-900/40 border border-slate-800/50 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/50">
              <h2 className="text-base font-bold text-white">Límites por categoría</h2>
              <p className="text-[10px] text-slate-500">Click en monto para editar</p>
            </div>
            {lines && lines.length > 0 ? (
              <div className="divide-y divide-slate-800/30">
                {lines.map((line: any) => (
                  <BudgetLineEditor
                    key={line.id}
                    lineId={line.id}
                    categoryName={categoryMap.get(line.category_level1_id) ?? 'Sin categoría'}
                    currentAmount={Number(line.budget_amount_home ?? 0)}
                    spentAmount={Number(line.spent_amount_home ?? 0)}
                    executionPct={Number(line.execution_pct ?? 0)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-slate-500 italic p-5">Sin líneas de presupuesto.</p>
            )}
          </div>

          <div className="rounded-2xl bg-slate-900/40 border border-slate-800/50 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/50">
              <h2 className="text-base font-bold text-white">Sinking Funds</h2>
              <AgregarSinkingFundButton />
            </div>
            {(sinkingFunds ?? []).length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 p-5">
                {(sinkingFunds ?? []).map((f: any) => <SinkingFundCard key={f.id} fund={f} />)}
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-slate-500 text-sm">Sin fondos de ahorro</p>
                <p className="text-slate-600 text-xs mt-1">Crea fondos para metas como marchamo, vacaciones, etc.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl bg-slate-900/40 border border-dashed border-slate-700">
          <p className="text-slate-400 text-sm mb-4">
            No hay presupuesto para <span className="text-white font-medium">{monthLabel}</span>
          </p>
          <CrearPresupuestoButton monthStartYMD={monthStartYMD} monthLabel={monthLabel} />
        </div>
      )}
    </div>
  )
}
