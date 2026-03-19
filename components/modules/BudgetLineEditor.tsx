'use client'

import { useState, useTransition } from 'react'
import { updateBudgetLineAmount } from '@/lib/actions/budgets'

interface Props {
  lineId: string
  categoryName: string
  currentAmount: number
  spentAmount: number
  executionPct: number
}

export default function BudgetLineEditor({ lineId, categoryName, currentAmount, spentAmount, executionPct }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(currentAmount))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const res = await updateBudgetLineAmount(lineId, parseFloat(value) || 0)
      if (res.success) setEditing(false)
    })
  }

  const pct = executionPct
  const pctColor = pct >= 100 ? 'text-rose-400' : pct >= 75 ? 'text-amber-400' : 'text-emerald-400'
  const barColor = pct >= 100 ? 'bg-rose-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'

  function formatMoney(n: number) {
    return `₡${Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  return (
    <div className="flex items-center gap-4 px-5 py-3 hover:bg-slate-800/20 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{categoryName}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <span className={`text-xs font-semibold ${pctColor} tabular-nums w-12 text-right`}>{pct.toFixed(0)}%</span>
        </div>
      </div>

      <div className="text-right shrink-0 w-28">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-20 rounded border border-indigo-500 bg-slate-900 px-2 py-1 text-xs text-white text-right"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
            />
            <button onClick={handleSave} disabled={isPending} className="text-indigo-400 text-xs hover:text-indigo-300">
              {isPending ? '...' : '✓'}
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-sm text-slate-300 hover:text-indigo-400 tabular-nums transition-colors">
            {formatMoney(currentAmount)}
          </button>
        )}
      </div>

      <div className="text-right shrink-0 w-28">
        <p className="text-sm text-slate-400 tabular-nums">{formatMoney(spentAmount)}</p>
        <p className="text-[10px] text-slate-600">gastado</p>
      </div>
    </div>
  )
}
