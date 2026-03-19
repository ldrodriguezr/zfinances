'use client'

import { useState, useTransition } from 'react'
import { createSinkingFund } from '@/lib/actions/sinking-funds'
import Modal from './Modal'

export default function AgregarSinkingFundButton() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createSinkingFund(formData)
      if (res.success) setOpen(false)
      else setError(res.error)
    })
  }

  const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none'

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg border border-slate-600 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 transition-colors">
        + Sinking Fund
      </button>
      {open && (
        <Modal title="Nuevo Sinking Fund" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Nombre</label>
              <input required name="name" className={inputCls} placeholder="Ej: Marchamo 2027" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Meta anual (₡)</label>
                <input required name="annual_target_home" type="number" className={inputCls} step="0.01" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Aporte mensual (₡)</label>
                <input required name="contribution_monthly_home" type="number" className={inputCls} step="0.01" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Mes objetivo (1-12)</label>
              <input name="target_month" type="number" className={inputCls} min="1" max="12" defaultValue="12" />
            </div>
            {error && <p className="text-rose-400 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>
              <button type="submit" disabled={isPending} className="flex-1 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {isPending ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
