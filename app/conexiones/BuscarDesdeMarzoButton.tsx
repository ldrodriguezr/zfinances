'use client'

import { useState } from 'react'

export default function BuscarDesdeMarzoButton() {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const year = new Date().getFullYear()
  const afterDate = `${year}-03-01`

  async function handleClick() {
    setLoading(true)
    setDone(false)
    try {
      const res = await fetch(`/api/ingestion/gmail/run?after=${afterDate}`, { method: 'POST' })
      if (res.ok) setDone(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? 'Buscando...' : `Buscar correos desde 1 de marzo ${year}`}
      </button>
      {done && <span className="text-sm text-emerald-400">Listo</span>}
    </div>
  )
}
