import { NextResponse } from 'next/server'
import { runBudgetExecutionForAllUsers } from '@/lib/budget/runner'

export async function GET() {
  await runBudgetExecutionForAllUsers()
  return NextResponse.json({ ok: true })
}

