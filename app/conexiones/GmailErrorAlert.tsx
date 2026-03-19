'use client'

import { useRouter } from 'next/navigation'

interface Props {
  message: string
}

export default function GmailErrorAlert({ message }: Props) {
  const router = useRouter()

  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
      <p className="font-medium text-rose-200 mb-1">Error al conectar Gmail</p>
      <p className="text-sm text-slate-400">{message}</p>
      <button
        type="button"
        onClick={() => router.replace('/conexiones')}
        className="mt-3 text-xs text-indigo-400 hover:text-indigo-300"
      >
        Cerrar
      </button>
    </div>
  )
}
