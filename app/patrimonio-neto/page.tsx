import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ensureUserOnboarding } from '@/lib/actions/onboarding'
import AgregarActivoButton from '@/components/modules/AgregarActivoButton'

function formatMoney(amount: number) {
  return `₡${Number(amount).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function depreciatedValue(purchaseValue: number, rateAnnual: number, purchaseDate: Date, asOf: Date, residual: number) {
  const months = Math.max(
    0,
    (asOf.getUTCFullYear() - purchaseDate.getUTCFullYear()) * 12 +
      (asOf.getUTCMonth() - purchaseDate.getUTCMonth())
  )
  const dep = purchaseValue * rateAnnual * (months / 12)
  return Math.max(purchaseValue - dep, residual)
}

export default async function PatrimonioNetoPage() {
  const supabase = await createClient()

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) redirect('/login')

  await ensureUserOnboarding(user.id)

  const { data: assets } = await supabase
    .from('assets')
    .select('id, name, asset_type, purchase_value, purchase_date, depreciation_rate_annual, residual_value_home, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const { data: debts } = await supabase
    .from('debts')
    .select('id, name, current_balance_home, currency')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const now = new Date()

  const assetsWithValue = (assets ?? []).map((a) => {
    const pv = Number(a.purchase_value ?? 0)
    const rate = Number(a.depreciation_rate_annual ?? 0)
    const pd = new Date(a.purchase_date)
    const res = a.residual_value_home != null ? Number(a.residual_value_home) : 0
    const currentValue = depreciatedValue(pv, rate, pd, now, res)
    return { ...a, currentValue, purchaseValue: pv }
  })

  const assetsTotal = assetsWithValue.reduce((acc, a) => acc + a.currentValue, 0)
  const liabilitiesTotal = (debts ?? []).reduce((acc, d) => acc + Number(d.current_balance_home ?? 0), 0)
  const netWorth = assetsTotal - liabilitiesTotal

  const { data: snapshots } = await supabase
    .from('net_worth_snapshots')
    .select('month_end, assets_home_total, liabilities_home_total, net_worth_home_total')
    .eq('user_id', user.id)
    .order('month_end', { ascending: false })
    .limit(12)

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white">Patrimonio Neto</h1>
          <p className="text-slate-400 mt-1 text-sm">Activos vs pasivos — valor actual depreciado</p>
        </div>
        <AgregarActivoButton />
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Activos</p>
          <h3 className="text-2xl font-black mt-2 text-emerald-400">{formatMoney(assetsTotal)}</h3>
          <p className="text-[10px] text-slate-600 mt-1">{assetsWithValue.length} activo{assetsWithValue.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pasivos</p>
          <h3 className="text-2xl font-black mt-2 text-rose-400">{formatMoney(liabilitiesTotal)}</h3>
          <p className="text-[10px] text-slate-600 mt-1">{(debts ?? []).length} deuda{(debts ?? []).length !== 1 ? 's' : ''}</p>
        </div>
        <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-600/20 to-cyan-600/20 border border-indigo-500/30">
          <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Patrimonio neto</p>
          <h3 className={`text-2xl font-black mt-2 ${netWorth >= 0 ? 'text-white' : 'text-rose-400'}`}>
            {formatMoney(netWorth)}
          </h3>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-slate-900/40 border border-slate-800/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800/50">
            <h2 className="text-lg font-bold text-white">Activos</h2>
          </div>
          {assetsWithValue.length > 0 ? (
            <div className="divide-y divide-slate-800/40">
              {assetsWithValue.map((a) => {
                const depPct = a.purchaseValue > 0 ? ((a.purchaseValue - a.currentValue) / a.purchaseValue) * 100 : 0
                return (
                  <div key={a.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-800/20 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 text-xs font-bold shrink-0">
                      {a.asset_type === 'VEHICLE' ? '🚗' : a.asset_type === 'REAL_ESTATE' ? '🏠' : '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{a.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Compra: {formatMoney(a.purchaseValue)} · Dep: {depPct.toFixed(0)}%
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-emerald-400 tabular-nums">{formatMoney(a.currentValue)}</p>
                      <p className="text-[10px] text-slate-600">valor actual</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-slate-500 text-sm">Sin activos registrados</p>
              <p className="text-slate-600 text-xs mt-1">Agrega vehículos, propiedades u otros activos</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-slate-900/40 border border-slate-800/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800/50">
            <h2 className="text-lg font-bold text-white">Pasivos</h2>
          </div>
          {debts && debts.length > 0 ? (
            <div className="divide-y divide-slate-800/40">
              {debts.map((d: any) => (
                <div key={d.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-800/20 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-400 text-xs font-bold shrink-0">
                    💳
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{d.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-rose-400 tabular-nums">{formatMoney(Number(d.current_balance_home ?? 0))}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-slate-500 text-sm">Sin deudas activas</p>
            </div>
          )}
        </div>
      </div>

      {snapshots && snapshots.length > 0 && (
        <div className="rounded-2xl bg-slate-900/40 border border-slate-800/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800/50">
            <h2 className="text-lg font-bold text-white">Evolución mensual</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="px-6 pb-3 pt-4 font-medium">Mes</th>
                  <th className="px-6 pb-3 pt-4 font-medium text-right">Activos</th>
                  <th className="px-6 pb-3 pt-4 font-medium text-right">Pasivos</th>
                  <th className="px-6 pb-3 pt-4 font-medium text-right">Patrimonio</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s: any) => (
                  <tr key={s.month_end} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                    <td className="px-6 py-3 text-slate-300">
                      {new Date(s.month_end).toLocaleDateString('es-CR', { month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-3 text-right text-emerald-400 tabular-nums">{formatMoney(Number(s.assets_home_total ?? 0))}</td>
                    <td className="px-6 py-3 text-right text-rose-400 tabular-nums">{formatMoney(Number(s.liabilities_home_total ?? 0))}</td>
                    <td className="px-6 py-3 text-right text-white font-medium tabular-nums">{formatMoney(Number(s.net_worth_home_total ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
