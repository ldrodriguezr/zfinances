'use client'

import { useState } from 'react'

type Stats = {
  messagesFound: number
  processed: number
  skippedLowConfidence: number
  skippedAlready: number
}

export default function BuscarDesdeMarzoButton() {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const year = new Date().getFullYear()
  const afterDate = `${year}-03-01`

  async function handleClick() {
    setLoading(true)
    setStats(null)
    setError(null)
    try {
      const res = await fetch(`/api/ingestion/gmail/run?after=${afterDate}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setStats(data.stats ?? null)
      } else {
        setError(data.error ?? `Error ${res.status}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? 'Buscando BAC, SINPE, comprobantes...' : `Buscar correos desde 1 de marzo ${year}`}
        </button>
      </div>
      {error && <span className="text-sm text-red-400">{error}</span>}
      {stats && (
        <div className="text-sm text-slate-400">
          {stats.messagesFound === 0 ? (
            <span>No se encontraron correos de BAC, SINPE o transacciones.</span>
          ) : (
            <span>
              Encontrados: {stats.messagesFound} · Procesados: {stats.processed}
              {stats.skippedLowConfidence > 0 && ` · Sin extraer (baja confianza): ${stats.skippedLowConfidence}`}
              {stats.skippedAlready > 0 && ` · Ya existían: ${stats.skippedAlready}`}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
