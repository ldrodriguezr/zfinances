import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ensureUserOnboarding } from '@/lib/actions/onboarding'
import CrearPresupuestoButton from '@/components/modules/CrearPresupuestoButton'

function formatMoney(amount: number) {
  return `₡${Number(amount).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
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

  const { data: categories } = await supabase.from('categories').select('id, name').eq('level', 1)

  const categoryMap = new Map((categories ?? []).map((c) => [c.id, c.name]))

  const { data: alerts } = budget
    ? await supabase
        .from('budget_alerts')
        .select('category_level1_id, threshold_pct, triggered_at')
        .eq('budget_id', budget.id)
    : { data: [] }

  const { data: sinkingFunds } = await supabase
    .from('sinking_funds')
    .select('id, name, annual_target_home, contribution_monthly_home, target_month, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Presupuestos (ZBB)</h1>
          <p className="text-slate-400 mt-1">Zero-Based Budgeting y Sinking Funds.</p>
        </div>
      </header>

      {budget ? (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ingresos del mes</p>
              <h3 className="text-3xl font-black mt-3 text-white">{formatMoney(Number(budget.income_total_home ?? 0))}</h3>
            </div>
            <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Disponible</p>
              <h3 className="text-3xl font-black mt-3 text-emerald-400">{formatMoney(Number(budget.available_home ?? 0))}</h3>
            </div>
            <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Estado</p>
              <h3 className="text-lg font-bold mt-3 text-slate-300">{budget.status}</h3>
            </div>
          </section>

          <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
            <h2 className="text-xl font-bold mb-6">Líneas de presupuesto</h2>
            {lines && lines.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-700">
                      <th className="pb-3 font-medium">Categoría</th>
                      <th className="pb-3 font-medium text-right">Presupuestado</th>
                      <th className="pb-3 font-medium text-right">Gastado</th>
                      <th className="pb-3 font-medium text-right">Ejecución</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line: any) => {
                      const catName = categoryMap.get(line.category_level1_id) ?? '—'
                      const pct = Number(line.execution_pct ?? 0)
                      const alert = alerts?.find((a: any) => a.category_level1_id === line.category_level1_id)
                      return (
                        <tr key={line.id} className="border-b border-slate-800/50">
                          <td className="py-3 text-white">{catName}</td>
                          <td className="py-3 text-right text-slate-300">{formatMoney(Number(line.budget_amount_home ?? 0))}</td>
                          <td className="py-3 text-right text-slate-300">{formatMoney(Number(line.spent_amount_home ?? 0))}</td>
                          <td className="py-3 text-right">
                            <span className={pct >= 100 ? 'text-rose-400' : pct >= 75 ? 'text-amber-400' : 'text-emerald-400'}>
                              {pct.toFixed(1)}%
                            </span>
                            {alert && (
                              <span className="ml-2 text-[10px] text-rose-400">Alerta {alert.threshold_pct}%</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 italic">No hay líneas de presupuesto para este mes. Crea categorías y asigna montos.</p>
            )}
          </div>

          {sinkingFunds && sinkingFunds.length > 0 && (
            <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
              <h2 className="text-xl font-bold mb-6">Sinking Funds</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {sinkingFunds.map((f: any) => (
                  <div key={f.id} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <p className="font-medium text-white">{f.name}</p>
                    <p className="text-sm text-slate-400 mt-1">
                      Meta anual: {formatMoney(Number(f.annual_target_home ?? 0))} • Aporte mensual: {formatMoney(Number(f.contribution_monthly_home ?? 0))}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Mes objetivo: {f.target_month}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 border-dashed">
          <p className="text-slate-500 italic mb-4">
            No hay presupuesto para {monthStart.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })}.
          </p>
          <CrearPresupuestoButton
            monthStartYMD={monthStartYMD}
            monthLabel={monthStart.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })}
          />
        </div>
      )}
    </div>
  )
}
