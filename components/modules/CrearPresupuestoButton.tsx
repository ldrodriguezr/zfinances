'use client'

import { useState, useTransition } from 'react'
import { createBudgetForMonth } from '@/lib/actions/budgets'

interface Props {
  monthStartYMD: string
  monthLabel: string
}

export default function CrearPresupuestoButton({ monthStartYMD, monthLabel }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const res = await createBudgetForMonth(monthStartYMD)
      if (res.success) {
        window.location.reload()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-600 disabled:opacity-60"
      >
        {isPending ? 'Creando...' : `Crear presupuesto ${monthLabel}`}
      </button>
      {error && <p className="mt-2 text-rose-400 text-sm">{error}</p>}
    </div>
  )
}
