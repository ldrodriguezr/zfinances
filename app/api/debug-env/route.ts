import { NextResponse } from 'next/server'

/**
 * GET /api/debug-env - Solo para diagnóstico en Vercel.
 * No revela valores, solo qué vars están definidas.
 */
export async function GET() {
  const status = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
  return NextResponse.json(status)
}
