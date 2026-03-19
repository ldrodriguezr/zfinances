'use client'

import { useTransition } from 'react'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => Promise<any>
  onCancel: () => void
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Eliminar', onConfirm, onCancel }: Props) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="text-sm text-slate-400 mt-2">{message}</p>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => startTransition(async () => { await onConfirm(); onCancel() })}
            disabled={isPending}
            className="flex-1 rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Eliminando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
