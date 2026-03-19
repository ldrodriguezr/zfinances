import { NextResponse } from 'next/server'
import { runGmailIngestion } from '@/lib/ingestion/gmail/runner'

export async function POST(req: Request) {
  const url = new URL(req.url)
  const after = url.searchParams.get('after') // YYYY-MM-DD, ej: 2025-03-01
  await runGmailIngestion({
    maxMessagesPerConnection: after ? 200 : 25,
    afterDate: after ?? undefined,
  })
  return NextResponse.json({ ok: true, after: after ?? null })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const after = url.searchParams.get('after') // YYYY-MM-DD, ej: 2025-03-01
  await runGmailIngestion({
    maxMessagesPerConnection: after ? 200 : 10,
    afterDate: after ?? undefined,
  })
  return NextResponse.json({ ok: true, after: after ?? null })
}

