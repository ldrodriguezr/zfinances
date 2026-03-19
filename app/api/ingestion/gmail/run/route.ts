import { NextResponse } from 'next/server'
import { runGmailIngestion } from '@/lib/ingestion/gmail/runner'

export async function POST(req: Request) {
  const url = new URL(req.url)
  const after = url.searchParams.get('after') // YYYY-MM-DD, ej: 2025-03-01
  const result = await runGmailIngestion({
    maxMessagesPerConnection: after ? 200 : 25,
    afterDate: after ?? undefined,
  })
  return NextResponse.json({
    ok: true,
    after: after ?? null,
    stats: result.stats ?? { messagesFound: 0, processed: 0, skippedLowConfidence: 0, skippedAlready: 0 },
  })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const after = url.searchParams.get('after') // YYYY-MM-DD, ej: 2025-03-01
  const result = await runGmailIngestion({
    maxMessagesPerConnection: after ? 200 : 10,
    afterDate: after ?? undefined,
  })
  return NextResponse.json({
    ok: true,
    after: after ?? null,
    stats: result.stats ?? { messagesFound: 0, processed: 0, skippedLowConfidence: 0, skippedAlready: 0 },
  })
}

