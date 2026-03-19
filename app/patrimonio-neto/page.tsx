import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ensureUserOnboarding } from '@/lib/actions/onboarding'

function formatMoney(amount: number) {
  return `₡${Number(amount).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
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
    .select('id, name, current_balance_home')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const now = new Date()
  const snapshotDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  const snapshotYMD = snapshotDate.toISOString().slice(0, 10)

  const { data: snapshots } = await supabase
    .from('net_worth_snapshots')
    .select('month_end, assets_home_total, liabilities_home_total, net_worth_home_total')
    .eq('user_id', user.id)
    .order('month_end', { ascending: false })
    .limit(12)

  let assetsTotal = 0
  for (const a of assets ?? []) {
    const purchaseValue = Number(a.purchase_value ?? 0)
    const rateAnnual = Number(a.depreciation_rate_annual ?? 0)
    const purchaseDate = new Date(a.purchase_date)
    const months = Math.max(
      0,
      (now.getUTCFullYear() - purchaseDate.getUTCFullYear()) * 12 +
        (now.getUTCMonth() - purchaseDate.getUTCMonth())
    )
    const depreciation = purchaseValue * rateAnnual * (months / 12)
    const residual = a.residual_value_home != null ? Number(a.residual_value_home) : 0
    assetsTotal += Math.max(purchaseValue - depreciation, residual)
  }

  const liabilitiesTotal = (debts ?? []).reduce((acc, d) => acc + Number(d.current_balance_home ?? 0), 0)
  const netWorth = assetsTotal - liabilitiesTotal

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Patrimonio Neto</h1>
          <p className="text-slate-400 mt-1">Activos, pasivos y evolución mensual.</p>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Activos totales</p>
          <h3 className="text-3xl font-black mt-3 text-emerald-400">{formatMoney(assetsTotal)}</h3>
        </div>
        <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pasivos totales</p>
          <h3 className="text-3xl font-black mt-3 text-rose-400">{formatMoney(liabilitiesTotal)}</h3>
        </div>
        <div className="p-8 rounded-3xl bg-gradient-to-br from-indigo-600/20 to-cyan-600/20 border border-indigo-500/30">
          <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Patrimonio neto</p>
          <h3 className="text-3xl font-black mt-3 text-white">{formatMoney(netWorth)}</h3>
        </div>
      </section>

      <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
        <h2 className="text-xl font-bold mb-6">Activos</h2>
        {assets && assets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="pb-3 font-medium">Nombre</th>
                  <th className="pb-3 font-medium">Tipo</th>
                  <th className="pb-3 font-medium text-right">Valor compra</th>
                  <th className="pb-3 font-medium text-right">Depreciación anual</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a: any) => (
                  <tr key={a.id} className="border-b border-slate-800/50">
                    <td className="py-3 text-white">{a.name}</td>
                    <td className="py-3 text-slate-400">{a.asset_type}</td>
                    <td className="py-3 text-right text-slate-300">{formatMoney(Number(a.purchase_value ?? 0))}</td>
                    <td className="py-3 text-right text-slate-300">{(Number(a.depreciation_rate_annual ?? 0) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 italic">No hay activos registrados.</p>
        )}
      </div>

      {snapshots && snapshots.length > 0 && (
        <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
          <h2 className="text-xl font-bold mb-6">Historial de snapshots</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="pb-3 font-medium">Mes</th>
                  <th className="pb-3 font-medium text-right">Activos</th>
                  <th className="pb-3 font-medium text-right">Pasivos</th>
                  <th className="pb-3 font-medium text-right">Patrimonio</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s: any) => (
                  <tr key={s.month_end} className="border-b border-slate-800/50">
                    <td className="py-3 text-slate-300">{new Date(s.month_end).toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })}</td>
                    <td className="py-3 text-right text-emerald-400">{formatMoney(Number(s.assets_home_total ?? 0))}</td>
                    <td className="py-3 text-right text-rose-400">{formatMoney(Number(s.liabilities_home_total ?? 0))}</td>
                    <td className="py-3 text-right text-white font-medium">{formatMoney(Number(s.net_worth_home_total ?? 0))}</td>
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
