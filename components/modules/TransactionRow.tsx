'use client'

import { useState, useTransition } from 'react'
import { updateTransaction, deleteTransaction } from '@/lib/actions/transactions'
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'

interface Transaction {
  id: string
  occurred_at: string
  description: string | null
  merchant: string | null
  amount_home: number
  amount_currency: number
  currency: string
  flow_type: string
  category_level1_id: string | null
}

interface Props {
  tx: Transaction
  homeCurrency: string
  categoryName: string | null
  categories: Array<{ id: string; name: string }>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CR', { day: '2-digit', month: 'short' })
}

function formatMoney(amount: number, code: string) {
  const sym = code === 'USD' ? '$' : '₡'
  return `${sym}${Number(amount).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function TransactionRow({ tx, homeCurrency, categoryName, categories }: Props) {
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isIncome = tx.flow_type === 'INCOME'
  const isExpense = tx.flow_type === 'EXPENSE'
  const displayAmount = Number(tx.amount_currency ?? tx.amount_home ?? 0)
  const txCurrency = tx.currency ?? homeCurrency

  const [editDesc, setEditDesc] = useState(tx.description ?? '')
  const [editMerchant, setEditMerchant] = useState(tx.merchant ?? '')
  const [editCat, setEditCat] = useState(tx.category_level1_id ?? '')

  function handleSave() {
    startTransition(async () => {
      await updateTransaction({
        id: tx.id,
        description: editDesc,
        merchant: editMerchant,
        categoryLevel1Id: editCat || null,
      })
      setShowEdit(false)
    })
  }

  const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none'

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-3 hover:bg-slate-800/30 transition-colors group">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
          isIncome ? 'bg-emerald-500/15 text-emerald-400' :
          isExpense ? 'bg-rose-500/15 text-rose-400' :
          'bg-slate-700/50 text-slate-400'
        }`}>
          {isIncome ? '+' : isExpense ? '-' : '↔'}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{tx.description || tx.merchant || 'Sin descripción'}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatDate(tx.occurred_at)}
            {categoryName && <span className="ml-2 text-indigo-400/60">{categoryName}</span>}
          </p>
        </div>

        <div className="text-right shrink-0 mr-2">
          <p className={`text-sm font-semibold tabular-nums ${isIncome ? 'text-emerald-400' : isExpense ? 'text-rose-400' : 'text-slate-300'}`}>
            {isIncome ? '+' : isExpense ? '-' : ''}{formatMoney(displayAmount, txCurrency)}
          </p>
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => setShowEdit(true)} className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition-colors">
            ✎
          </button>
          <button onClick={() => setShowDelete(true)} className="p-1.5 rounded-md hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 text-xs transition-colors">
            ✕
          </button>
        </div>
      </div>

      {showEdit && (
        <Modal title="Editar transacción" onClose={() => setShowEdit(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Descripción</label>
              <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Comercio</label>
              <input value={editMerchant} onChange={(e) => setEditMerchant(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Categoría</label>
              <select value={editCat} onChange={(e) => setEditCat(e.target.value)} className={inputCls}>
                <option value="">Sin categoría</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowEdit(false)} className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={isPending} className="flex-1 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDelete && (
        <ConfirmDialog
          title="Eliminar transacción"
          message={`¿Eliminar "${tx.description || tx.merchant || 'transacción'}"? Esta acción no se puede deshacer.`}
          onConfirm={() => deleteTransaction(tx.id)}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </>
  )
}
