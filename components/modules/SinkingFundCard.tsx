'use client'

import { useState, useTransition } from 'react'
import { updateSinkingFund, deleteSinkingFund } from '@/lib/actions/sinking-funds'
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'

interface Fund {
  id: string
  name: string
  annual_target_home: number
  contribution_monthly_home: number
  target_month: number
}

interface Props {
  fund: Fund
}

function formatMoney(n: number) {
  return `₡${Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function SinkingFundCard({ fund }: Props) {
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [editName, setEditName] = useState(fund.name)
  const [editTarget, setEditTarget] = useState(String(fund.annual_target_home))
  const [editMonthly, setEditMonthly] = useState(String(fund.contribution_monthly_home))
  const [editMonth, setEditMonth] = useState(String(fund.target_month))

  function handleSave() {
    startTransition(async () => {
      await updateSinkingFund({
        id: fund.id, name: editName,
        annualTargetHome: parseFloat(editTarget) || 0,
        contributionMonthlyHome: parseFloat(editMonthly) || 0,
        targetMonth: parseInt(editMonth) || 12,
      })
      setShowEdit(false)
    })
  }

  const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none'
  const progress = fund.annual_target_home > 0
    ? Math.min(100, (fund.contribution_monthly_home * new Date().getMonth() / fund.annual_target_home) * 100)
    : 0

  return (
    <>
      <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-slate-600 transition-colors group">
        <div className="flex items-start justify-between">
          <p className="font-medium text-white text-sm">{fund.name}</p>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setShowEdit(true)} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white text-xs">✎</button>
            <button onClick={() => setShowDelete(true)} className="p-1 rounded hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 text-xs">✕</button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Meta: {formatMoney(fund.annual_target_home)} · {formatMoney(fund.contribution_monthly_home)}/mes
        </p>
        <div className="mt-2 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-[10px] text-slate-600 mt-1">Mes objetivo: {fund.target_month}</p>
      </div>

      {showEdit && (
        <Modal title="Editar fondo" onClose={() => setShowEdit(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Nombre</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Meta anual</label>
                <input type="number" value={editTarget} onChange={(e) => setEditTarget(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Aporte mensual</label>
                <input type="number" value={editMonthly} onChange={(e) => setEditMonthly(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Mes objetivo (1-12)</label>
              <input type="number" value={editMonth} onChange={(e) => setEditMonth(e.target.value)} className={inputCls} min="1" max="12" />
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
        <ConfirmDialog title="Eliminar fondo" message={`¿Eliminar "${fund.name}"?`} onConfirm={() => deleteSinkingFund(fund.id)} onCancel={() => setShowDelete(false)} />
      )}
    </>
  )
}
