import { createBrowserClient } from '@supabase/ssr'

// 🚨 No olvides el "export" al principio
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // 🎯 Esto es lo que nos mantiene en la "habitación" de finanzas
      db: {
        schema: 'personal_finance',
      },
    }
  )
}