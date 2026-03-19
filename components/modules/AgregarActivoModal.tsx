'use client'

import { useState, useTransition } from 'react'
import { createAsset } from '@/lib/actions/assets'

interface Props {
  onClose: () => void
}

export default function AgregarActivoModal({ onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await createAsset(formData)
      if (res.success) {
        onClose()
      } else {
        setError(res.error)
      }
    })
  }

  const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-4">Agregar activo</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">Nombre</label>
            <input required name="name" type="text" className={inputCls} placeholder="Ej: Toyota Yaris 2020" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">Tipo</label>
            <select name="asset_type" className={inputCls}>
              <option value="VEHICLE">Vehículo</option>
              <option value="REAL_ESTATE">Propiedad</option>
              <option value="ELECTRONICS">Electrónica</option>
              <option value="INVESTMENT">Inversión</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">Valor compra (₡)</label>
              <input required name="purchase_value" type="number" step="0.01" min="0" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">Fecha compra</label>
              <input name="purchase_date" type="date" className={inputCls} defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">Depreciación anual</label>
              <input name="depreciation_rate_annual" type="number" step="0.01" min="0" max="1" className={inputCls} defaultValue="0.15" />
              <p className="text-[10px] text-slate-600 mt-0.5">0.15 = 15% anual</p>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">Valor residual (₡)</label>
              <input name="residual_value_home" type="number" step="0.01" min="0" className={inputCls} placeholder="Opcional" />
            </div>
          </div>
          {error && <p className="text-rose-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="flex-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {isPending ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
