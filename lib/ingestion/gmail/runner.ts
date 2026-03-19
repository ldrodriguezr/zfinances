import { createAdminClient } from '@/utils/supabase/admin'
import { parseGmailBodyToTransaction, buildIdempotencyKey } from './parser'
import { postIngestedTransactionToLedger } from '@/lib/ledger/ledger'

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(normalized, 'base64').toString('utf8')
}

function findHeader(headers: Array<{ name?: string; value?: string }>, name: string) {
  const h = headers.find((x) => (x.name ?? '').toLowerCase() === name.toLowerCase())
  return h?.value
}

function extractBodiesFromPayload(payload: any): { html?: string; text?: string } {
  const walk = (node: any): { html?: string; text?: string } => {
    if (!node) return {}
    const mime = (node.mimeType ?? '').toLowerCase()

    if (mime === 'text/html' && node.body?.data) {
      return { html: base64UrlDecode(node.body.data) }
    }
    if (mime === 'text/plain' && node.body?.data) {
      return { text: base64UrlDecode(node.body.data) }
    }

    if (Array.isArray(node.parts)) {
      for (const p of node.parts) {
        const found = walk(p)
        if (found.html || found.text) return found
      }
    }

    // A veces el body está directo si no hay parts.
    if (node.body?.data && !mime) {
      return { text: base64UrlDecode(node.body.data) }
    }

    return {}
  }

  return walk(payload)
}

async function getAccessTokenFromRefreshToken(params: { refreshToken: string }) {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Faltan GMAIL_OAUTH_CLIENT_ID / GMAIL_OAUTH_CLIENT_SECRET')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: params.refreshToken,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OAuth token exchange failed: ${res.status} ${text}`)
  }

  const json = (await res.json()) as any
  if (!json.access_token) throw new Error('No access_token en respuesta OAuth')
  return String(json.access_token)
}

function inferIsDebitLike(textUpper: string) {
  // Heurística por idioma común; se afina según tu banco real.
  return /\b(CARGO|DEBITO|DEBIT|EGRESO|PAGO)\b/i.test(textUpper)
}

export async function runGmailIngestion(params?: {
  maxMessagesPerConnection?: number
  /** Fecha desde la cual buscar (YYYY-MM-DD). Ej: "2025-03-01" para correos desde el 1 de marzo. */
  afterDate?: string
}) {
  const supabase = createAdminClient()
  const afterDate = params?.afterDate
  const maxMessagesPerConnection = params?.maxMessagesPerConnection ?? (afterDate ? 200 : 25)

  const { data: connections, error: cErr } = await supabase
    .from('gmail_connections')
    .select('id, user_id, email_address, refresh_token')
    .eq('provider', 'gmail')
    .eq('token_status', 'ACTIVE')

  if (cErr) throw cErr

  if (!connections?.length) return { processedConnections: 0, stats: { messagesFound: 0, processed: 0, skippedLowConfidence: 0, skippedAlready: 0 } }

  const stats = { messagesFound: 0, processed: 0, skippedLowConfidence: 0, skippedAlready: 0 }

  for (const conn of connections) {
    const userId = conn.user_id as string
    const accessToken = await getAccessTokenFromRefreshToken({ refreshToken: conn.refresh_token as string })

    // Pull incremental “simple”: últimos días. Para producción, sincroniza por historyId/labelId.
    const datePart = afterDate
      ? `after:${afterDate.replace(/-/g, '/')}`
      : 'newer_than:14d'
    const bankingTerms = afterDate
      ? ' (bac OR sinpe OR comprobante OR transaccion OR transferencia OR notificacion OR "estado de cuenta" OR movimiento)'
      : ''
    let gmailQuery = datePart + bankingTerms
    let q = encodeURIComponent(gmailQuery)
    let listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${maxMessagesPerConnection}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    let listJson: any = {}
    if (listRes.ok) listJson = await listRes.json()
    let messageIds: string[] = (listJson.messages ?? []).map((m: any) => String(m.id)).filter(Boolean)
    // Si la búsqueda con términos bancarios no devuelve nada, intentar solo por fecha
    if (afterDate && messageIds.length === 0) {
      gmailQuery = datePart
      q = encodeURIComponent(gmailQuery)
      listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${maxMessagesPerConnection}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (listRes.ok) {
        listJson = await listRes.json()
        messageIds = (listJson.messages ?? []).map((m: any) => String(m.id)).filter(Boolean)
      }
    }
    if (!listRes.ok) continue
    stats.messagesFound += messageIds.length
    if (!messageIds.length) continue

    for (const gmailMessageId of messageIds) {
      // Idempotencia: si ya procesamos, saltamos.
      const { data: existing } = await supabase
        .from('gmail_messages')
        .select('id, extraction_status')
        .eq('user_id', userId)
        .eq('gmail_message_id', gmailMessageId)
        .maybeSingle()

      if (existing?.extraction_status && existing.extraction_status !== 'PENDING') {
        stats.skippedAlready++
        continue
      }

      // Detail
      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}?format=full`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!msgRes.ok) continue
      const msgJson = (await msgRes.json()) as any

      const subject = findHeader(msgJson?.payload?.headers ?? [], 'Subject')
      const bodies = extractBodiesFromPayload(msgJson?.payload)
      const parser = parseGmailBodyToTransaction({
        subject,
        htmlBody: bodies.html,
        textBody: bodies.text,
        receivedAt: msgJson?.internalDate ? new Date(Number(msgJson.internalDate)).toISOString() : undefined,
      })

      const rawText = (parser as any).rawText as string | undefined
      const textUpper = (rawText ?? '').toUpperCase()
      const isDebitLike = inferIsDebitLike(textUpper)

      const idempotencyKey = buildIdempotencyKey({
        userId,
        gmailMessageId,
        occurredAt: parser.occurredAt,
        amount: parser.amount,
        currency: parser.currency,
        externalReference: parser.externalReference,
      })

      // Guardamos “la evidencia” del parseo (external_transactions puede postear o no).
      const { error: gmErr } = await supabase.from('gmail_messages').upsert(
        {
          user_id: userId,
          gmail_message_id: gmailMessageId,
          thread_id: msgJson?.threadId ?? null,
          received_at: msgJson?.internalDate ? new Date(Number(msgJson.internalDate)).toISOString() : null,
          subject: subject ?? null,
          snippet: msgJson?.snippet ?? null,
          extraction_status: parser.parseConfidence >= 50 ? 'PARSED' : 'ERROR',
          extraction_error: parser.parseConfidence >= 50 ? null : 'low_confidence',
        },
        { onConflict: 'user_id,gmail_message_id' }
      )

      if (gmErr) continue

      if (parser.parseConfidence < 50) {
        stats.skippedLowConfidence++
        continue
      }

      stats.processed++
      try {
        const { transactionId } = await postIngestedTransactionToLedger({
          userId,
          sourceType: 'GMAIL',
          occurredAtISO: parser.occurredAt,
          description: subject ? `Gmail: ${subject}` : undefined,
          merchant: parser.merchant,
          externalReference: parser.externalReference ?? idempotencyKey,
          amount: Math.abs(parser.amount),
          currency: String(parser.currency),
          fxRate: parser.fxRate,
          isDebitLike,
        })

        // External record (opcional; el “posting” ya creó transactions).
        const { data: extRows, error: extErr } = await supabase
          .from('external_transactions')
          .upsert(
          {
            user_id: userId,
            source_type: 'GMAIL_BANKING',
            external_reference: parser.externalReference ?? idempotencyKey,
            occurred_at: parser.occurredAt,
            currency: String(parser.currency),
            amount: Math.abs(parser.amount),
            merchant: parser.merchant ?? null,
            parse_confidence: parser.parseConfidence,
            raw: {},
            status: 'MATCHED',
          },
          { onConflict: 'user_id,external_reference' }
          )
          .select('id')

        if (extErr) throw extErr
        const externalTransactionId = String(extRows?.[0]?.id ?? '')

        await supabase.from('reconciliations').upsert(
          {
            user_id: userId,
            external_transaction_id: externalTransactionId,
            transaction_id: transactionId,
            method: 'auto',
          },
          { onConflict: 'external_transaction_id' }
        )
      } catch {
        // Si falla posting, no rompemos el job.
        await supabase
          .from('gmail_messages')
          .update({ extraction_status: 'ERROR', extraction_error: 'ledger_post_failed' })
          .eq('user_id', userId)
          .eq('gmail_message_id', gmailMessageId)
      }
    }
  }

  return { ok: true, stats }
}

