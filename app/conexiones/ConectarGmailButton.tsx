'use client'

import { useRouter } from 'next/navigation'

export default function ConectarGmailButton() {
  const router = useRouter()

  function handleConnect() {
    router.push('/api/gmail/oauth/start')
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-500/90 hover:bg-indigo-500 text-white font-bold uppercase tracking-widest text-sm transition-colors"
    >
      Conectar Gmail
    </button>
  )
}
