/**
 * Validación y debug de variables de entorno Supabase.
 * Los nombres deben coincidir EXACTAMENTE con Vercel.
 */

function normalize(v: string | undefined): string {
  const s = String(v ?? '').trim()
  return s === 'undefined' || s === 'null' ? '' : s
}

export function checkSupabaseEnv(scope: 'client' | 'server'): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  const url = normalize(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const anon = normalize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  if (!url) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL')
    console.error('[Supabase env] UNDEFINED or empty: NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!anon) {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    console.error('[Supabase env] UNDEFINED or empty: NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  if (scope === 'server') {
    const serviceKey = normalize(process.env.SUPABASE_SERVICE_ROLE_KEY)
    if (!serviceKey) {
      missing.push('SUPABASE_SERVICE_ROLE_KEY')
      console.error('[Supabase env] UNDEFINED or empty: SUPABASE_SERVICE_ROLE_KEY')
    }
  }
  return { ok: missing.length === 0, missing }
}

export function getSupabaseUrl(): string {
  const v = normalize(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (!v) {
    console.error('[Supabase env] UNDEFINED or empty: NEXT_PUBLIC_SUPABASE_URL')
    return ''
  }
  return v
}

export function getSupabaseAnonKey(): string {
  const v = normalize(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  if (!v) {
    console.error('[Supabase env] UNDEFINED or empty: NEXT_PUBLIC_SUPABASE_ANON_KEY')
    return ''
  }
  return v
}

export function getSupabaseServiceRoleKey(): string | undefined {
  const v = normalize(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!v) {
    console.error('[Supabase env] UNDEFINED or empty: SUPABASE_SERVICE_ROLE_KEY')
    return undefined
  }
  return v
}
