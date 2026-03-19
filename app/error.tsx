'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-10 text-center">
      <h2 className="text-xl font-bold text-white">Algo salió mal</h2>
      <p className="mt-2 text-slate-400 text-sm max-w-md">
        Revisa que las variables de entorno en Vercel estén configuradas: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-xl bg-indigo-500 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-600"
      >
        Reintentar
      </button>
    </div>
  )
}
