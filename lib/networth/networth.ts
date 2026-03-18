import { createAdminClient } from '@/utils/supabase/admin'

function clampMin(n: number, min: number) {
  return Math.max(min, n)
}

export async function runNetWorthMonthEndSnapshot(params: { userId: string; monthEndISO: string }) {
  const supabase = createAdminClient()
  const { userId, monthEndISO } = params

  const snapshotDate = new Date(monthEndISO)
  const snapshotYMD = snapshotDate.toISOString().slice(0, 10)

  const { data: assets } = await supabase
    .from('assets')
    .select('id, purchase_value, purchase_date, depreciation_rate_annual, residual_value_home')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!assets?.length) {
    // Aun si no hay activos, guardamos snapshot neto en base a pasivos.
  }

  let assetsTotal = 0

  for (const asset of assets ?? []) {
    const purchaseValue = Number(asset.purchase_value ?? 0)
    const rateAnnual = Number(asset.depreciation_rate_annual ?? 0)
    const purchaseDate = new Date(asset.purchase_date)
    const months = Math.max(0, (snapshotDate.getUTCFullYear() - purchaseDate.getUTCFullYear()) * 12 + (snapshotDate.getUTCMonth() - purchaseDate.getUTCMonth()))
    const depreciation = purchaseValue * rateAnnual * (months / 12)
    const residual = asset.residual_value_home != null ? Number(asset.residual_value_home) : 0
    const value = clampMin(purchaseValue - depreciation, residual)
    assetsTotal += value

    await supabase
      .from('asset_valuation_snapshots')
      .upsert(
        {
          asset_id: asset.id,
          user_id: userId,
          snapshot_date: snapshotYMD,
          value_home: value,
        },
        { onConflict: 'asset_id,snapshot_date' }
      )
  }

  const { data: debts } = await supabase
    .from('debts')
    .select('current_balance_home')
    .eq('user_id', userId)
    .eq('is_active', true)

  const liabilitiesTotal = (debts ?? []).reduce((acc: number, d: any) => acc + Number(d.current_balance_home ?? 0), 0)
  const netWorth = assetsTotal - liabilitiesTotal

  await supabase
    .from('net_worth_snapshots')
    .upsert(
      {
        user_id: userId,
        month_end: snapshotYMD,
        assets_home_total: assetsTotal,
        liabilities_home_total: liabilitiesTotal,
        net_worth_home_total: netWorth,
      },
      { onConflict: 'user_id,month_end' }
    )

  return { netWorth }
}

