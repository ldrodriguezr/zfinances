'use client'

import { useState, useTransition } from 'react'
import { updateAsset, deleteAsset } from '@/lib/actions/assets'
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'

interface Asset {
  id: string
  name: string
  asset_type: string
  currentValue: number
  purchaseValue: number
  depreciation_rate_annual: number
  residual_value_home: number | null
}

interface Props {
  asset: Asset
}

function formatMoney(n: number) {
  return `₡${Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const TYPE_ICONS: Record<string, string> = {
  VEHICLE: '🚗', REAL_ESTATE: '🏠', ELECTRONICS: '💻', INVESTMENT: '📈', OTHER: '📦',
}

export default function AssetRow({ asset }: Props) {
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [editName, setEditName] = useState(asset.name)
  const [editValue, setEditValue] = useState(String(asset.purchaseValue))
  const [editDep, setEditDep] = useState(String(asset.depreciation_rate_annual))
  const [editResidual, setEditResidual] = useState(String(asset.residual_value_home ?? ''))

  const depPct = asset.purchaseValue > 0 ? ((asset.purchaseValue - asset.currentValue) / asset.purchaseValue) * 100 : 0

  function handleSave() {
    startTransition(async () => {
      await updateAsset({
        id: asset.id, name: editName,
        purchaseValue: parseFloat(editValue) || 0,
        depreciationRateAnnual: parseFloat(editDep) || 0,
        residualValueHome: editResidual ? parseFloat(editResidual) : null,
      })
      setShowEdit(false)
    })
  }

  const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none'

  return (
    <>
      <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-800/20 transition-colors group">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-sm shrink-0">
          {TYPE_ICONS[asset.asset_type] ?? '📦'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{asset.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">Compra: {formatMoney(asset.purchaseValue)} · Dep: {depPct.toFixed(0)}%</p>
        </div>
        <div className="text-right shrink-0 mr-2">
          <p className="text-sm font-semibold text-emerald-400 tabular-nums">{formatMoney(asset.currentValue)}</p>
          <p className="text-[10px] text-slate-600">valor actual</p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => setShowEdit(true)} className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white text-xs">✎</button>
          <button onClick={() => setShowDelete(true)} className="p-1.5 rounded-md hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 text-xs">✕</button>
        </div>
      </div>

      {showEdit && (
        <Modal title="Editar activo" onClose={() => setShowEdit(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Nombre</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Valor compra (₡)</label>
              <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} className={inputCls} step="0.01" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Dep. anual</label>
                <input type="number" value={editDep} onChange={(e) => setEditDep(e.target.value)} className={inputCls} step="0.01" min="0" max="1" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Valor residual</label>
                <input type="number" value={editResidual} onChange={(e) => setEditResidual(e.target.value)} className={inputCls} step="0.01" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowEdit(false)} className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>
              <button onClick={handleSave} disabled={isPending} className="flex-1 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDelete && (
        <ConfirmDialog
          title="Eliminar activo"
          message={`¿Eliminar "${asset.name}"?`}
          onConfirm={() => deleteAsset(asset.id)}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </>
  )
}
