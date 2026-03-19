// components/modules/TransactionForm.tsx
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
  const [selectedCategoryLevel1, setSelectedCategoryLevel1] = useState<string>('')
  const [selectedCategoryLevel2, setSelectedCategoryLevel2] = useState<string>('')

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => a.account_type === 'LIQUIDITY' && a.currency === selectedCurrency)
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
      } else {
        alert(res.error)
      }
    })
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-300">Tipo de Flujo</label>
        <select required name="flow_type" defaultValue="EXPENSE" className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-white">
          <option value="EXPENSE">Gasto (sale dinero)</option>
          <option value="INCOME">Ingreso (entra dinero)</option>
          <option value="TRANSFER">Transferencia (base)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-300">Moneda</label>
        <select
          required
          name="currency"
          value={selectedCurrency}
          onChange={(e) => setSelectedCurrency(e.target.value as 'CRC' | 'USD')}
          className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-white"
        >
          <option value="CRC">CRC (Colones)</option>
          <option value="USD">USD (Dólares)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-300">Cuenta de Origen (Liquidez)</label>
        <select required name="account_id" className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-white">
          <option value="">Selecciona cuenta...</option>
          {filteredAccounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-300">Monto</label>
        <input required name="amount" type="number" step="0.01" min="0" className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-white" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-300">Fecha</label>
        <input
          required
          name="date"
          type="date"
          className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-white"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-300">Descripción</label>
        <input name="description" type="text" className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-white" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-300">Comercio / Beneficiario (opcional)</label>
        <input name="merchant" type="text" className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-white" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-300">Categoría (Nivel 1)</label>
        <select
          name="category_level1_id"
          value={selectedCategoryLevel1}
          onChange={(e) => {
            setSelectedCategoryLevel1(e.target.value)
            setSelectedCategoryLevel2('')
          }}
          className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-white"
        >
          <option value="">Selecciona categoría...</option>
          {level1Categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-300">Subcategoría (Nivel 2) (opcional)</label>
        <select
          name="category_level2_id"
          value={selectedCategoryLevel2}
          onChange={(e) => setSelectedCategoryLevel2(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-white"
        >
          <option value="">Selecciona subcategoría...</option>
          {level2Categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-300">Etiqueta/Tag (Nivel 3) (opcional)</label>
        <select name="tag_level3_id" className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-white">
          <option value="">Sin tag</option>
          {level3Tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl bg-indigo-500/90 text-white py-2.5 text-xs font-bold uppercase tracking-widest disabled:opacity-60"
        >
          {isPending ? 'Procesando...' : 'Crear Asiento'}
        </button>
      </div>
    </form>
  )
}