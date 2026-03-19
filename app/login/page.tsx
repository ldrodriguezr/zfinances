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
        setError('Cuenta creada. Revisa tu correo para confirmar.')
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error al autenticar')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-colors'

  return (
    <div className="w-full max-w-sm mx-auto px-4 animate-in fade-in duration-500">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          ZENFINANCE
        </h1>
        {reason && <p className="text-xs text-amber-400 mt-2">{reason}</p>}
      </div>

      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 shadow-2xl">
        <div className="flex gap-1 mb-6 bg-slate-800/50 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${mode === 'signin' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${mode === 'signup' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className={inputCls} placeholder="tu@email.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Contraseña</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className={inputCls} placeholder="••••••••" />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>
          )}

          <button
            disabled={loading}
            type="submit"
            className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 text-white py-3 text-xs font-bold uppercase tracking-widest hover:from-indigo-600 hover:to-cyan-600 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
          >
            {loading ? 'Procesando...' : mode === 'signin' ? 'Entrar' : 'Registrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-slate-400">Cargando...</div>}>
      <LoginForm />
    </Suspense>
  )
}
