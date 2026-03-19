'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { createTransaction } from '@/lib/actions/transactions'

interface Props {
  accounts: Array<{ id: string; name: string; currency: string; account_type: string }>
  categories: Array<{ id: string; name: string; level: number; parent_category_id: string | null }>
}

export default function TransactionForm({ accounts, categories }: Props) {
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const [selectedCurrency, setSelectedCurrency] = useState<'CRC' | 'USD'>('CRC')
  const [selectedFlowType, setSelectedFlowType] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER'>('EXPENSE')
  const [selectedCategoryLevel1, setSelectedCategoryLevel1] = useState<string>('')
  const [selectedCategoryLevel2, setSelectedCategoryLevel2] = useState<string>('')

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => a.currency === selectedCurrency)
  }, [accounts, selectedCurrency])

  const level1Categories = useMemo(() => categories.filter((c) => c.level === 1), [categories])
  const level2Categories = useMemo(
    () => categories.filter((c) => c.level === 2 && c.parent_category_id === selectedCategoryLevel1),
    [categories, selectedCategoryLevel1]
  )
  const level3Tags = useMemo(
    () => categories.filter((c) => c.level === 3 && c.parent_category_id === selectedCategoryLevel2),
    [categories, selectedCategoryLevel2]
  )

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await createTransaction(formData)
      if (res.success) {
        formRef.current?.reset()
        setSelectedCategoryLevel1('')
        setSelectedCategoryLevel2('')
      } else {
        alert(res.error)
      }
    })
  }

  const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-colors'

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Flujo</label>
          <select
            required
            name="flow_type"
            value={selectedFlowType}
            onChange={(e) => setSelectedFlowType(e.target.value as 'EXPENSE' | 'INCOME' | 'TRANSFER')}
            className={inputCls}
          >
            <option value="EXPENSE">Gasto</option>
            <option value="INCOME">Ingreso</option>
            <option value="TRANSFER">Transferencia</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Moneda</label>
          <select
            required
            name="currency"
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value as 'CRC' | 'USD')}
            className={inputCls}
          >
            <option value="CRC">₡ CRC</option>
            <option value="USD">$ USD</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cuenta</label>
        {filteredAccounts.length > 0 ? (
          <select required name="account_id" className={inputCls}>
            <option value="">Selecciona cuenta...</option>
            {filteredAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="rounded-lg border border-dashed border-amber-600/50 bg-amber-900/10 px-3 py-2.5 text-sm">
            <p className="text-amber-400">No hay cuentas en {selectedCurrency}.</p>
            <p className="text-xs text-amber-500/70 mt-1">
              Ve a configuración o recarga la app para que se creen automáticamente.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Monto</label>
          <input required name="amount" type="number" step="0.01" min="0" placeholder="0.00" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fecha</label>
          <input
            required
            name="date"
            type="date"
            className={inputCls}
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Descripción</label>
        <input name="description" type="text" placeholder="Ej: Almuerzo con equipo" className={inputCls} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Comercio (opcional)</label>
        <input name="merchant" type="text" placeholder="Ej: Walmart, Uber" className={inputCls} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Categoría</label>
        <select
          name="category_level1_id"
          value={selectedCategoryLevel1}
          onChange={(e) => {
            setSelectedCategoryLevel1(e.target.value)
            setSelectedCategoryLevel2('')
          }}
          className={inputCls}
        >
          <option value="">Sin categoría</option>
          {level1Categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {level2Categories.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Subcategoría</label>
          <select
            name="category_level2_id"
            value={selectedCategoryLevel2}
            onChange={(e) => setSelectedCategoryLevel2(e.target.value)}
            className={inputCls}
          >
            <option value="">General</option>
            {level2Categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      )}

      {level3Tags.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tag</label>
          <select name="tag_level3_id" className={inputCls}>
            <option value="">Sin tag</option>
            {level3Tags.map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || filteredAccounts.length === 0}
        className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white py-2.5 text-xs font-bold uppercase tracking-widest hover:from-indigo-600 hover:to-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
      >
        {isPending ? 'Procesando...' : 'Registrar'}
      </button>
    </form>
  )
}
