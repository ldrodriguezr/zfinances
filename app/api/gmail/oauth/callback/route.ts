import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 400 })

  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) return NextResponse.json({ ok: false, error: 'missing OAuth env' }, { status: 500 })

  const redirectUri =
    process.env.GMAIL_OAUTH_REDIRECT_URI ??
    (() => {
      const u = new URL(req.url)
      return `${u.origin}/api/gmail/oauth/callback`
    })()

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => '')
    return NextResponse.json({ ok: false, error: `token_exchange_failed`, detail: text }, { status: 400 })
  }

  const json = (await tokenRes.json()) as any
  const refreshToken = json.refresh_token as string | undefined
  const accessToken = json.access_token as string | undefined

  const supabase = createAdminClient()
  const userId = state

  let emailAddress: string | undefined
  if (accessToken) {
    try {
      const meRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (meRes.ok) {
        const me = (await meRes.json()) as any
        emailAddress = me.email as string | undefined
      }
    } catch {
      // best-effort
    }
  }

  // Guardamos conexión. Si el provider no devuelve refresh_token (no es primer grant),
  // se respeta el refresh_token existente y sólo se actualiza token_status.
  const { data: existing } = await supabase
    .from('gmail_connections')
    .select('email_address, refresh_token')
    .eq('user_id', userId)
    .eq('provider', 'gmail')
    .maybeSingle()

  const finalEmail = emailAddress ?? (existing?.email_address as string | undefined) ?? 'unknown'
  const finalRefresh = refreshToken ?? (existing?.refresh_token as string | undefined)

  const { error } = await supabase.from('gmail_connections').upsert(
    {
      user_id: userId,
      provider: 'gmail',
      email_address: finalEmail,
      refresh_token: finalRefresh,
      token_status: 'ACTIVE',
    },
    { onConflict: 'user_id,email_address' }
  )

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const successUrl = process.env.GMAIL_OAUTH_SUCCESS_URL ?? '/'
  return NextResponse.redirect(successUrl)
}

