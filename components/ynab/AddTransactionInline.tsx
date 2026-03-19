'use client'

import { useState, useTransition } from 'react'
import { createTransaction } from '@/lib/actions/transactions'

type Category = { id: string; name: string; level: number; parent_category_id: string | null }

export default function AddTransactionInline({
  accountId,
  categories,
  onDone,
}: {
  accountId: string
  categories: Category[]
  onDone?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [payee, setPayee] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [memo, setMemo] = useState('')
  const [outflow, setOutflow] = useState('')
  const [inflow, setInflow] = useState('')

  const groups = categories.filter((c) => c.level === 1)

  function reset() {
    setDate(new Date().toISOString().slice(0, 10))
    setPayee('')
    setCategoryId('')
    setMemo('')
    setOutflow('')
    setInflow('')
  }

  function handleSave() {
    if (!payee.trim()) return
    startTransition(async () => {
      await createTransaction({
        date,
        payee: payee.trim(),
        categoryId: categoryId || undefined,
        memo: memo.trim() || undefined,
        accountId,
        outflow: parseFloat(outflow) || 0,
        inflow: parseFloat(inflow) || 0,
      })
      reset()
      setOpen(false)
      onDone?.()
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm text-ynab-blue-light hover:bg-white/5 rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Transaction
      </button>
    )
  }

  const inputCls = 'w-full px-2 py-1.5 text-sm bg-ynab-bg border border-ynab-border rounded text-white focus:outline-none focus:border-ynab-blue'

  return (
    <div className="border-b border-ynab-blue/30 bg-ynab-blue/5 px-4 py-3">
      <div className="grid grid-cols-[100px_1fr_1fr_1fr_100px_100px_80px] gap-2 items-center">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        <input placeholder="Payee" value={payee} onChange={(e) => setPayee(e.target.value)} className={inputCls} />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
          <option value="">Category...</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <input placeholder="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} />
        <input
          placeholder="Outflow"
          type="number"
          value={outflow}
          onChange={(e) => { setOutflow(e.target.value); if (e.target.value) setInflow('') }}
          className={`${inputCls} text-right`}
        />
        <input
          placeholder="Inflow"
          type="number"
          value={inflow}
          onChange={(e) => { setInflow(e.target.value); if (e.target.value) setOutflow('') }}
          className={`${inputCls} text-right`}
        />
        <div className="flex gap-1">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-2 py-1.5 rounded bg-ynab-blue text-white text-xs font-semibold hover:bg-ynab-blue-light disabled:opacity-50"
          >
            {isPending ? '...' : 'Save'}
          </button>
          <button
            onClick={() => { reset(); setOpen(false) }}
            className="px-2 py-1.5 rounded text-ynab-text-dim text-xs hover:bg-white/5"
          >
            X
          </button>
        </div>
      </div>
    </div>
  )
}
