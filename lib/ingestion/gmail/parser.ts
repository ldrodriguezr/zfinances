import crypto from 'crypto'

export type ParsedTransaction = {
  occurredAt: string // ISO string
  currency: 'CRC' | 'USD' | string
  amount: number
  merchant?: string
  externalReference?: string
  fxRate?: number
  parseConfidence: number // 0..100
}

const MONTH_KEYWORDS = ['FECHA', 'DATE', 'COMPROBANTE', 'TRANSACTION', 'MOVIMIENTO', 'SINPE', 'BAC']

function decodeBasicHtmlEntities(input: string) {
  // Decodificación mínima para montos/fechas; los bancos suelen usar `&nbsp;` y entidades comunes.
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function htmlToText(html: string) {
  const decoded = decodeBasicHtmlEntities(html)

  // Remueve bloques de script/style y sus contenidos.
  const noScripts = decoded.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
  const noStyles = noScripts.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')

  // Convierte tags comunes a separadores.
  const withoutTags = noStyles
    .replace(/<\/(p|div|br|li|tr|td|th)>/gi, '\n')
    .replace(/<(p|div|br|li|tr|td|th)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  return withoutTags
    .replace(/[ \t]+/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalize(text: string) {
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function tryParseIsoDate(candidate: string) {
  // YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null
  const d = new Date(candidate + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function tryParseDmyDate(d: string, m: string, y: string) {
  // DD/MM/YYYY o D/M/YY
  const day = parseInt(d, 10)
  const month = parseInt(m, 10)
  let year = parseInt(y, 10)
  if (y.length === 2) year += year >= 70 ? 1900 : 2000
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function extractOccurredAt(text: string): { occurredAtIso?: string; confidence: number } {
  const normalized = normalize(text)
  const upper = normalized.toUpperCase()

  // ISO first
  const isoMatch = normalized.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  const iso = isoMatch ? tryParseIsoDate(isoMatch[1]) : null
  if (iso) return { occurredAtIso: iso, confidence: 80 }

  // D/M/Y patterns
  const dmy = normalized.match(/\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](\d{2,4})\b/)
  if (dmy) {
    const parsed = tryParseDmyDate(dmy[1], dmy[2], dmy[3])
    if (parsed) {
      const nearKeyword = MONTH_KEYWORDS.some((k) => upper.includes(k) && normalized.indexOf(dmy[0]) >= 0)
      return { occurredAtIso: parsed, confidence: nearKeyword ? 75 : 60 }
    }
  }

  // Fallback: busca alrededor de keyword
  for (const key of MONTH_KEYWORDS) {
    const i = upper.indexOf(key)
    if (i < 0) continue
    const window = normalized.slice(Math.max(0, i - 50), Math.min(normalized.length, i + 120))
    const iso2 = window.match(/\b(\d{4}-\d{2}-\d{2})\b/)
    const dmy2 = window.match(/\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](\d{2,4})\b/)
    if (iso2) {
      const parsed = tryParseIsoDate(iso2[1])
      if (parsed) return { occurredAtIso: parsed, confidence: 65 }
    }
    if (dmy2) {
      const parsed = tryParseDmyDate(dmy2[1], dmy2[2], dmy2[3])
      if (parsed) return { occurredAtIso: parsed, confidence: 55 }
    }
  }

  return { occurredAtIso: undefined, confidence: 0 }
}

function inferCurrency(textUpper: string) {
  if (/\b(USD|US\$)\b/.test(textUpper) || /US\s*dollar/i.test(textUpper)) return 'USD'
  if (/\b(CRC|COL|COLONES)\b/.test(textUpper) || /₡/.test(textUpper)) return 'CRC'
  // BAC y SINPE en Costa Rica usan colones por defecto
  if (/\b(BAC|SINPE)\b/.test(textUpper)) return 'CRC'
  return undefined
}

function parseMoneyNumber(raw: string) {
  const s = raw.trim()
  // Detecta separador decimal como el último de '.' o ','
  const hasDot = s.includes('.')
  const hasComma = s.includes(',')

  let normalized = s
  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf('.')
    const lastComma = s.lastIndexOf(',')
    const decimalSep = lastDot > lastComma ? '.' : ','
    const thousandSep = decimalSep === '.' ? ',' : '.'
    normalized = s.split(thousandSep).join('')
    normalized = normalized.replace(decimalSep, '.')
  } else if (hasComma && !hasDot) {
    // Si sólo hay coma, asumimos que es decimal si hay 1-2 decimales, o miles si hay 3-.
    const parts = s.split(',')
    if (parts.length === 2 && parts[1].length >= 1 && parts[1].length <= 6) {
      normalized = parts[0].replace(/\./g, '') + '.' + parts[1]
    } else {
      normalized = s.replace(/,/g, '')
    }
  } else {
    // Sólo punto o ninguno
    normalized = s.replace(/,/g, '')
  }

  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  return n
}

function extractFxRate(textUpper: string, textRaw: string) {
  // TIP0 DE CAMBIO / TC / FX
  const rateKeyword = /(TIPO\s*DE\s*CAMBIO|TC|FX)/i
  if (!rateKeyword.test(textUpper)) return undefined

  const m = textRaw.match(/(?:TIPO\s*DE\s*CAMBIO|TC|FX)\s*[:\-]?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{1,8})|[0-9]+(?:[.,][0-9]{1,8})?)/i)
  if (!m) return undefined

  const n = parseMoneyNumber(m[1])
  if (!n) return undefined
  return n
}

function scoreAmountCandidate(nearUpper: string, currency?: string) {
  let score = 20
  if (currency && nearUpper.includes(currency)) score += 25
  if (/\b(TOTAL|MONTO|IMPORTE|AMOUNT|NETO)\b/i.test(nearUpper)) score += 25
  if (/\b(REFERENCIA|FOLIO|COMPROBANTE)\b/i.test(nearUpper)) score += 5
  if (/\b(SINPE|BAC|TRANSACCION|PAGO|TRANSFERENCIA)\b/i.test(nearUpper)) score += 15
  return score
}

function extractAmountCurrency(text: string) {
  const upper = text.toUpperCase()
  const currency = inferCurrency(upper)

  // Busca símbolos o códigos cercanos a un número.
  const moneyRegex =
    /(?:(?:₡|CRC|USD|US\$|COL)\s*)?(\d{1,3}(?:[.,]\d{3})*|\d+)([.,]\d{1,6})?/g

  const candidates: Array<{ amount: number; currency?: string; score: number }> = []

  for (const match of text.matchAll(moneyRegex)) {
    const full = match[0]
    const whole = match[1]
    const dec = match[2] ?? ''
    const rawNumber = whole + dec
    const amount = parseMoneyNumber(rawNumber)
    if (!amount || amount <= 0) continue

    const idx = full ? upper.indexOf(full.toUpperCase()) : -1
    const window = idx >= 0 ? upper.slice(Math.max(0, idx - 40), Math.min(upper.length, idx + 80)) : upper
    const score = scoreAmountCandidate(window, currency)
    candidates.push({ amount, currency, score })
  }

  if (candidates.length === 0) return { amount: undefined as number | undefined, currency: currency as string | undefined, score: 0 }

  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]
  const parseConfidence = Math.min(90, 20 + best.score / 2)
  return { amount: best.amount, currency: best.currency, score: parseConfidence }
}

function extractExternalReference(textUpper: string, text: string) {
  const patterns: RegExp[] = [
    /\b(?:REFERENCIA|REF\.?|FOLIO|AUTORIZACI[ÓO]N|TICKET|COMPROBANTE|N[°o]\s*DE\s*TRANSACCION)\s*[:\-]?\s*\b([A-Z0-9][A-Z0-9\-]{5,})\b/i,
    /\b(?:COMPROBANTE)\s*[:\-]?\s*\b([A-Z0-9][A-Z0-9\-]{5,})\b/i,
    /\b(?:FOLIO)\s*[:\-]?\s*\b([A-Z0-9][A-Z0-9\-]{5,})\b/i,
  ]

  for (const p of patterns) {
    const m = text.match(p)
    if (m?.[1]) return m[1].trim()
  }

  // Fallback: SINPE patterns tend to have reference-like numbers
  const sinpe = textUpper.includes('SINPE')
  if (sinpe) {
    const m = text.match(/\b(SINPE(?:\s*MOVIL)?)\b.*?\b(?:REF\.?|REFERENCIA|FOLIO|COMPROBANTE|AUTORIZACI[ÓO]N)\b.*?\b([A-Z0-9][A-Z0-9\-]{5,})\b/i)
    if (m?.[2]) return m[2].trim()
  }

  return undefined
}

function extractMerchant(textUpper: string, text: string) {
  // Heurística básica: línea con keywords y texto alrededor.
  const kw = /(COMERCIO|BENEFICIARIO|RECEPTOR|ORDENANTE|EMISOR|DESCRIPCI[ÓO]N)\s*[:\-]?\s*/i
  const m = text.match(kw)
  if (m && m.index != null) {
    const start = m.index + m[0].length
    const window = text.slice(start, start + 80).replace(/\n/g, ' ').trim()
    const cleaned = window.split(/[\r\n]+/)[0].trim()
    if (cleaned) return cleaned.slice(0, 60)
  }

  // Fallback: primera frase “limpia” con letras.
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const best = lines.find((l) => l.length >= 3 && /[A-ZÁÉÍÓÚÜÑ]/i.test(l) && !/\d/.test(l.slice(0, 10)))
  return best?.slice(0, 60)
}

export function parseGmailBodyToTransaction(params: {
  subject?: string
  htmlBody?: string
  textBody?: string
  receivedAt?: string
}) {
  const { subject, htmlBody, textBody } = params
  const rawText = normalize(
    (textBody && normalize(textBody)) ||
      (htmlBody ? htmlToText(htmlBody) : '') ||
      (subject ?? '')
  )

  const textUpper = rawText.toUpperCase()

  const { occurredAtIso, confidence: dateConfidence } = extractOccurredAt(rawText)
  const { amount, currency, score: amountConfidence } = extractAmountCurrency(rawText)
  const fxRate = extractFxRate(textUpper, rawText)
  const externalReference = extractExternalReference(textUpper, rawText)
  const merchant = extractMerchant(textUpper, rawText)

  const confidence = Math.max(dateConfidence, 0) + Math.max(amountConfidence, 0) * 0.6

  if (!occurredAtIso || amount == null || !currency) {
    return {
      occurredAt: new Date().toISOString(),
      currency: currency ?? 'CRC',
      amount: amount ?? 0,
      merchant,
      externalReference,
      fxRate,
      parseConfidence: 5,
      rawText,
    } as ParsedTransaction & { rawText: string }
  }

  return {
    occurredAt: occurredAtIso,
    currency,
    amount,
    merchant,
    externalReference,
    fxRate,
    parseConfidence: Math.min(100, Math.max(10, confidence)),
  } as ParsedTransaction
}

export function buildIdempotencyKey(params: {
  userId: string
  gmailMessageId: string
  occurredAt: string
  amount: number
  currency: string
  externalReference?: string
}) {
  const input = `${params.userId}|${params.gmailMessageId}|${params.occurredAt}|${params.amount}|${params.currency}|${params.externalReference ?? ''}`
  return crypto.createHash('sha256').update(input).digest('hex')
}

