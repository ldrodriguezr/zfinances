import { NextResponse } from 'next/server'
import { runGmailIngestion } from '@/lib/ingestion/gmail/runner'

export async function GET() {
  // No usamos auth de usuario: este endpoint está pensado para Cron serverless (Vercel).
  // Para producción: agrega validación por header o secreto.
  await runGmailIngestion({ maxMessagesPerConnection: 25 })
  return NextResponse.json({ ok: true })
}

