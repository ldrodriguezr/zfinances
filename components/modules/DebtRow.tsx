'use client'

import { useState, useTransition } from 'react'
import { updateDebt, deleteDebt, registerDebtPayment } from '@/lib/actions/debts'
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'

interface Debt {
  id: string
  name: string
  debt_type: string
  current_balance_home: number
  apr_annual: number | null
  min_payment_home: number | null
  currency: string
}

interface Props {
  debt: Debt
  extraPayment: number
  homeCurrency: string
  isTarget: boolean
  order: number
  promoApr: number | null
}

function formatMoney(n: number, c: string) {
  return `${c === 'USD' ? '$' : '₡'}${Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function DebtRow({ debt, extraPayment, homeCurrency, isTarget, order, promoApr }: Props) {
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showPay, setShowPay] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [editName, setEditName] = useState(debt.name)
  const [editBalance, setEditBalance] = useState(String(debt.current_balance_home))
  const [editApr, setEditApr] = useState(String(debt.apr_annual ?? ''))
  const [editMin, setEditMin] = useState(String(debt.min_payment_home ?? ''))
  const [payAmount, setPayAmount] = useState('')

  const apr = promoApr ?? Number(debt.apr_annual ?? 0)

  function handleSaveEdit() {
    startTransition(async () => {
      await updateDebt({
        id: debt.id, name: editName,
        currentBalanceHome: parseFloat(editBalance) || 0,
        aprAnnual: editApr ? parseFloat(editApr) : null,
        minPaymentHome: editMin ? parseFloat(editMin) : null,
      })
      setShowEdit(false)
    })
  }

  function handlePay() {
    const amt = parseFloat(payAmount)
    if (!amt || amt <= 0) return
    startTransition(async () => {
      await registerDebtPayment({ debtId: debt.id, amount: amt })
      setShowPay(false)
      setPayAmount('')
    })
  }

  const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none'

  return (
    <>
      <div className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-800/20 transition-colors group ${isTarget ? 'bg-indigo-500/5 border-l-2 border-l-indigo-500' : ''}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${isTarget ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
          {order}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white truncate">{debt.name}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 uppercase">{debt.debt_type}</span>
            {promoApr != null && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400">Promo</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            APR: {apr}%{debt.min_payment_home ? ` · Mín: ${formatMoney(Number(debt.min_payment_home), debt.currency)}` : ''}
          </p>
        </div>

        <div className="text-right shrink-0 mr-2">
          <p className="text-sm font-semibold text-rose-400 tabular-nums">{formatMoney(Number(debt.current_balance_home), debt.currency)}</p>
          {extraPayment > 0 && <p className="text-xs text-emerald-400">+{formatMoney(extraPayment, homeCurrency)} extra</p>}
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => setShowPay(true)} className="p-1.5 rounded-md hover:bg-emerald-900/50 text-slate-400 hover:text-emerald-400 text-xs" title="Registrar pago">$</button>
          <button onClick={() => setShowEdit(true)} className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white text-xs" title="Editar">✎</button>
          <button onClick={() => setShowDelete(true)} className="p-1.5 rounded-md hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 text-xs" title="Eliminar">✕</button>
        </div>
      </div>

      {showPay && (
        <Modal title={`Pago a ${debt.name}`} onClose={() => setShowPay(false)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Balance actual: <span className="text-white font-medium">{formatMoney(Number(debt.current_balance_home), debt.currency)}</span></p>
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Monto del pago</label>
              <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className={inputCls} placeholder="0" min="0" step="0.01" autoFocus />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPay(false)} className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>
              <button onClick={handlePay} disabled={isPending} className="flex-1 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {isPending ? 'Procesando...' : 'Registrar pago'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title="Editar deuda" onClose={() => setShowEdit(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Nombre</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Balance</label>
              <input type="number" value={editBalance} onChange={(e) => setEditBalance(e.target.value)} className={inputCls} step="0.01" min="0" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">APR (%)</label>
                <input type="number" value={editApr} onChange={(e) => setEditApr(e.target.value)} className={inputCls} step="0.01" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Pago mínimo</label>
                <input type="number" value={editMin} onChange={(e) => setEditMin(e.target.value)} className={inputCls} step="0.01" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowEdit(false)} className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800">Cancelar</button>
              <button onClick={handleSaveEdit} disabled={isPending} className="flex-1 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDelete && (
        <ConfirmDialog
          title="Eliminar deuda"
          message={`¿Eliminar "${debt.name}"? La deuda se marcará como inactiva.`}
          onConfirm={() => deleteDebt(debt.id)}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </>
  )
}
