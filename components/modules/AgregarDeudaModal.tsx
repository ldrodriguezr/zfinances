'use client'

import { useState, useTransition } from 'react'
import { createDebt } from '@/lib/actions/debts'

interface Props {
  onClose: () => void
}

export default function AgregarDeudaModal({ onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const res = await createDebt(formData)
      if (res.success) {
        onClose()
        form.reset()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-4">Agregar deuda</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Nombre</label>
            <input
              required
              name="name"
              type="text"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
              placeholder="Ej: Tarjeta BAC"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Tipo</label>
            <select name="debt_type" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white">
              <option value="INSTALLMENT">Cuotas fijas</option>
              <option value="REVOLVING">Revolvente</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Balance actual</label>
            <input
              required
              name="current_balance_home"
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Moneda</label>
            <select name="currency" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white">
              <option value="CRC">CRC</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">APR anual (%)</label>
            <input name="apr_annual" type="number" step="0.01" min="0" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" placeholder="Opcional" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Pago mínimo</label>
            <input name="min_payment_home" type="number" step="0.01" min="0" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" placeholder="Opcional" />
          </div>
          {error && <p className="text-rose-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-800">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="flex-1 rounded-lg bg-indigo-500 px-4 py-2 font-bold text-white disabled:opacity-60">
              {isPending ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
