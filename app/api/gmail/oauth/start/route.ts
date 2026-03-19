import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: userData, error: uErr } = await supabase.auth.getUser()
  if (uErr || !userData.user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID
  if (!clientId) return NextResponse.json({ ok: false, error: 'missing GMAIL_OAUTH_CLIENT_ID' }, { status: 500 })

  const redirectUri =
    process.env.GMAIL_OAUTH_REDIRECT_URI ??
    (() => {
      const url = new URL(req.url)
      return `${url.origin}/api/gmail/oauth/callback`
    })()

  const scope = process.env.GMAIL_OAUTH_SCOPE ?? 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email'
  const state = userData.user.id

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', scope)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('state', state)

  return NextResponse.redirect(authUrl.toString())
}

