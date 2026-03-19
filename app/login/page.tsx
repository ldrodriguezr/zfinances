'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: authError } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (mode === 'signup') {
      const supabaseAdmin = createClient()
      await supabaseAdmin.from('user_settings').upsert({ user_id: (await supabase.auth.getUser()).data.user?.id, home_currency: 'CRC' })
    }

    router.replace('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ynab-bg px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">
            Zen<span className="text-ynab-blue-light">Budget</span>
          </h1>
          <p className="text-ynab-text-muted text-sm mt-1">Give every dollar a job</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-ynab-surface border border-ynab-border rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-ynab-text-muted mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg bg-ynab-bg border border-ynab-border text-sm text-white placeholder:text-ynab-text-dim focus:outline-none focus:border-ynab-blue focus:ring-1 focus:ring-ynab-blue"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ynab-text-muted mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2.5 rounded-lg bg-ynab-bg border border-ynab-border text-sm text-white placeholder:text-ynab-text-dim focus:outline-none focus:border-ynab-blue focus:ring-1 focus:ring-ynab-blue"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-ynab-red text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-ynab-blue text-white text-sm font-semibold hover:bg-ynab-blue-light disabled:opacity-50 transition-colors"
          >
            {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <p className="text-center text-xs text-ynab-text-dim">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-ynab-blue-light hover:underline"
            >
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
