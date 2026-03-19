import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

function redirectError(reqUrl: string, msg: string) {
  const origin = new URL(reqUrl).origin
  const url = new URL('/conexiones', origin)
  url.searchParams.set('error', encodeURIComponent(msg))
  return NextResponse.redirect(url.toString())
}

function redirectSuccess() {
  const successUrl = process.env.GMAIL_OAUTH_SUCCESS_URL ?? '/conexiones'
  return NextResponse.redirect(successUrl)
}

export async function GET(req: Request) {
  const reqUrl = req.url
  try {
    const url = new URL(reqUrl)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) return redirectError(reqUrl, 'Faltan parámetros de Google. Intenta de nuevo.')

    const clientId = process.env.GMAIL_OAUTH_CLIENT_ID
    const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET
    if (!clientId || !clientSecret) return redirectError(reqUrl, 'Faltan variables GMAIL_OAUTH en Vercel.')

    const redirectUri =
      process.env.GMAIL_OAUTH_REDIRECT_URI ?? `${url.origin}/api/gmail/oauth/callback`

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
      console.error('[Gmail OAuth] token exchange failed:', tokenRes.status, text)
      return redirectError(reqUrl, 'Google no devolvió tokens. Revoca el acceso en myaccount.google.com y vuelve a intentar.')
    }

    const json = (await tokenRes.json()) as any
    const refreshToken = json.refresh_token as string | undefined
    const accessToken = json.access_token as string | undefined

    if (!refreshToken) {
      return redirectError(
        reqUrl,
        'Google no devolvió refresh_token. Ve a myaccount.google.com → Seguridad → Acceso de terceros, revoca ZenFinance, y vuelve a conectar.'
      )
    }

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

    const { data: existing } = await supabase
      .from('gmail_connections')
      .select('email_address, refresh_token')
      .eq('user_id', userId)
      .eq('provider', 'gmail')
      .maybeSingle()

    const finalEmail = emailAddress ?? (existing?.email_address as string | undefined) ?? 'unknown'
    const finalRefresh = refreshToken ?? (existing?.refresh_token as string | undefined)

    if (!finalRefresh) {
      return redirectError(reqUrl, 'No se pudo obtener el refresh_token. Revoca y vuelve a intentar.')
    }

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

    if (error) {
      console.error('[Gmail OAuth] db upsert failed:', error.message)
      return redirectError(reqUrl, `Error al guardar: ${error.message}`)
    }

    return redirectSuccess()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    console.error('[Gmail OAuth] callback error:', msg)
    return redirectError(reqUrl, `Error: ${msg}`)
  }
}
