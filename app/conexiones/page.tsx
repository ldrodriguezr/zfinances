import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ensureUserOnboarding } from '@/lib/actions/onboarding'
import ConectarGmailButton from './ConectarGmailButton'
import GmailErrorAlert from './GmailErrorAlert'

export default async function ConexionesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient()

  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) redirect('/login')

  await ensureUserOnboarding(user.id)

  const params = await searchParams
  const errorMsg = params.error ? decodeURIComponent(params.error) : null

  const { data: gmailConnections } = await supabase
    .from('gmail_connections')
    .select('id, email_address, created_at')
    .eq('user_id', user.id)

  const hasGmailOAuth = !!(process.env.GMAIL_OAUTH_CLIENT_ID && process.env.GMAIL_OAUTH_CLIENT_SECRET)

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Conexiones</h1>
          <p className="text-slate-400 mt-1">Conecta Gmail para ingesta automática de transacciones.</p>
        </div>
      </header>

      <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800">
        <h2 className="text-xl font-bold mb-6">Gmail</h2>
        {errorMsg && <GmailErrorAlert message={errorMsg} />}
        <div className="flex flex-col gap-4 mt-4">
          {hasGmailOAuth ? (
            <>
              <ConectarGmailButton />
              <p className="text-sm text-slate-500">
                El flujo OAuth te redirigirá a Google. Tras autorizar, las credenciales se guardan y el cron diario ingerirá correos de tu bandeja.
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
              <p className="font-medium text-amber-200 mb-2">Configuración pendiente</p>
              <p className="text-sm text-slate-400 mb-4">
                Para conectar Gmail, añade estas variables en Vercel → Settings → Environment Variables:
              </p>
              <ul className="text-sm text-slate-300 space-y-1 font-mono">
                <li>• GMAIL_OAUTH_CLIENT_ID</li>
                <li>• GMAIL_OAUTH_CLIENT_SECRET</li>
                <li>• GMAIL_OAUTH_REDIRECT_URI (opcional: https://zfinances.vercel.app/api/gmail/oauth/callback)</li>
              </ul>
              <p className="text-xs text-slate-500 mt-4">
                Crea credenciales OAuth 2.0 en Google Cloud Console → APIs & Services → Credentials. Añade el redirect URI como URI autorizado.
              </p>
            </div>
          )}
        </div>

        {gmailConnections && gmailConnections.length > 0 && (
          <div className="mt-8 pt-8 border-t border-slate-700">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Cuentas conectadas</h3>
            <ul className="space-y-2">
              {gmailConnections.map((c: any) => (
                <li key={c.id} className="flex items-center gap-3 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {c.email_address}
                  <span className="text-xs text-slate-500">
                    desde {new Date(c.created_at).toLocaleDateString('es-CR')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
