import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ensureUserOnboarding } from '@/lib/actions/onboarding'
import AgregarActivoButton from '@/components/modules/AgregarActivoButton'
import AssetRow from '@/components/modules/AssetRow'

function formatMoney(n: number) {
  return `₡${Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function depreciatedValue(pv: number, rate: number, pd: Date, now: Date, residual: number) {
  const months = Math.max(0, (now.getUTCFullYear() - pd.getUTCFullYear()) * 12 + (now.getUTCMonth() - pd.getUTCMonth()))
  return Math.max(pv - (pv * rate * (months / 12)), residual)
}

export default async function PatrimonioNetoPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) redirect('/login')

  await ensureUserOnboarding(user.id)

  const [assetsRes, debtsRes, snapshotsRes] = await Promise.all([
    supabase.from('assets').select('id, name, asset_type, purchase_value, purchase_date, depreciation_rate_annual, residual_value_home').eq('user_id', user.id).eq('is_active', true),
    supabase.from('debts').select('id, name, current_balance_home, currency').eq('user_id', user.id).eq('is_active', true),
    supabase.from('net_worth_snapshots').select('month_end, assets_home_total, liabilities_home_total, net_worth_home_total').eq('user_id', user.id).order('month_end', { ascending: false }).limit(12),
  ])

  const now = new Date()
  const assetsWithValue = (assetsRes.data ?? []).map((a) => {
    const pv = Number(a.purchase_value ?? 0)
    const rate = Number(a.depreciation_rate_annual ?? 0)
    const res = a.residual_value_home != null ? Number(a.residual_value_home) : 0
    return { ...a, currentValue: depreciatedValue(pv, rate, new Date(a.purchase_date), now, res), purchaseValue: pv }
  })

  const assetsTotal = assetsWithValue.reduce((s, a) => s + a.currentValue, 0)
  const liabTotal = (debtsRes.data ?? []).reduce((s, d) => s + Number(d.current_balance_home ?? 0), 0)
  const netWorth = assetsTotal - liabTotal

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Patrimonio Neto</h1>
          <p className="text-slate-400 mt-1 text-sm">Activos vs pasivos — valor depreciado</p>
        </div>
        <AgregarActivoButton />
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Activos</p>
          <p className="text-xl font-black mt-1.5 text-emerald-400">{formatMoney(assetsTotal)}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">{assetsWithValue.length} activo{assetsWithValue.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pasivos</p>
          <p className="text-xl font-black mt-1.5 text-rose-400">{formatMoney(liabTotal)}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">{(debtsRes.data ?? []).length} deuda{(debtsRes.data ?? []).length !== 1 ? 's' : ''}</p>
        </div>
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-600/15 to-cyan-600/15 border border-indigo-500/20">
          <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Patrimonio neto</p>
          <p className={`text-xl font-black mt-1.5 ${netWorth >= 0 ? 'text-white' : 'text-rose-400'}`}>{formatMoney(netWorth)}</p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-slate-900/40 border border-slate-800/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/50"><h2 className="text-base font-bold text-white">Activos</h2></div>
          {assetsWithValue.length > 0 ? (
            <div className="divide-y divide-slate-800/30">
              {assetsWithValue.map((a) => <AssetRow key={a.id} asset={a as any} />)}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-slate-500 text-sm">Sin activos registrados</p>
              <p className="text-slate-600 text-xs mt-1">Agrega vehículos, propiedades u otros</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-slate-900/40 border border-slate-800/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/50"><h2 className="text-base font-bold text-white">Pasivos (Deudas)</h2></div>
          {(debtsRes.data ?? []).length > 0 ? (
            <div className="divide-y divide-slate-800/30">
              {(debtsRes.data ?? []).map((d: any) => (
                <div key={d.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center text-sm shrink-0">💳</div>
                  <p className="flex-1 text-sm font-medium text-white truncate">{d.name}</p>
                  <p className="text-sm font-semibold text-rose-400 tabular-nums">{formatMoney(Number(d.current_balance_home ?? 0))}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center"><p className="text-slate-500 text-sm">Sin deudas activas</p></div>
          )}
        </div>
      </div>

      {(snapshotsRes.data ?? []).length > 0 && (
        <div className="rounded-2xl bg-slate-900/40 border border-slate-800/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/50"><h2 className="text-base font-bold text-white">Evolución mensual</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="px-5 pb-2.5 pt-3 font-medium">Mes</th>
                  <th className="px-5 pb-2.5 pt-3 font-medium text-right">Activos</th>
                  <th className="px-5 pb-2.5 pt-3 font-medium text-right">Pasivos</th>
                  <th className="px-5 pb-2.5 pt-3 font-medium text-right">Neto</th>
                </tr>
              </thead>
              <tbody>
                {(snapshotsRes.data ?? []).map((s: any) => (
                  <tr key={s.month_end} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                    <td className="px-5 py-2.5 text-slate-300">{new Date(s.month_end).toLocaleDateString('es-CR', { month: 'short', year: 'numeric' })}</td>
                    <td className="px-5 py-2.5 text-right text-emerald-400 tabular-nums">{formatMoney(Number(s.assets_home_total ?? 0))}</td>
                    <td className="px-5 py-2.5 text-right text-rose-400 tabular-nums">{formatMoney(Number(s.liabilities_home_total ?? 0))}</td>
                    <td className="px-5 py-2.5 text-right text-white font-medium tabular-nums">{formatMoney(Number(s.net_worth_home_total ?? 0))}</td>
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
