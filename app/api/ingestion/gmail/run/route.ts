import { NextResponse } from 'next/server'
import { runGmailIngestion } from '@/lib/ingestion/gmail/runner'

export async function POST() {
  await runGmailIngestion({ maxMessagesPerConnection: 25 })
  return NextResponse.json({ ok: true })
}

export async function GET() {
  await runGmailIngestion({ maxMessagesPerConnection: 10 })
  return NextResponse.json({ ok: true })
}

