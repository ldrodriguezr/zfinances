'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Mode = 'signin' | 'signup'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason') ?? ''

  const supabase = createClient()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (mode === 'signin') {
        const { error: signErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signErr) throw signErr
        router.replace('/')
        return
      }

      const { data, error: signUpErr } = await supabase.auth.signUp({ email, password })
      if (signUpErr) throw signUpErr

      if ((data as any)?.session) {
        router.replace('/')
      } else {
        setError('Cuenta creada. Revisa tu correo para confirmar la dirección (si aplica).')
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error al autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-10 max-w-md mx-auto space-y-6 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Login</h1>
        <p className="text-slate-400 mt-2 text-sm">
          {reason ? `Sesión requerida: ${reason}` : 'Inicia sesión o crea una cuenta para continuar.'}
        </p>
      </div>

      <form onSubmit={onSubmit} className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 shadow-2xl space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={mode === 'signin' ? 'flex-1 rounded-xl bg-indigo-500/90 text-white py-2 text-xs font-bold uppercase tracking-widest' : 'flex-1 rounded-xl bg-slate-800/50 text-slate-300 py-2 text-xs font-bold uppercase tracking-widest'}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={mode === 'signup' ? 'flex-1 rounded-xl bg-indigo-500/90 text-white py-2 text-xs font-bold uppercase tracking-widest' : 'flex-1 rounded-xl bg-slate-800/50 text-slate-300 py-2 text-xs font-bold uppercase tracking-widest'}
          >
            Crear cuenta
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-white"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-white"
          />
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            {error}
          </div>
        ) : null}

        <button
          disabled={loading}
          type="submit"
          className="w-full rounded-xl bg-indigo-500/90 text-white py-2.5 text-xs font-bold uppercase tracking-widest disabled:opacity-60"
        >
          {loading ? 'Procesando...' : mode === 'signin' ? 'Entrar' : 'Registrar'}
        </button>

        <p className="text-[10px] text-slate-500 italic">
          Tip: si tu proyecto requiere confirmación de email, el login puede fallar hasta que confirmes.
        </p>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-10 text-slate-400">Cargando...</div>}>
      <LoginForm />
    </Suspense>
  )
}
