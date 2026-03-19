import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getBudgetData } from '@/lib/actions/budget-assign'
import { ensureUserSeed } from '@/lib/actions/seed'
import BudgetPageClient from './BudgetPageClient'

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await ensureUserSeed(user.id)

  const params = await searchParams
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth()

  if (params.month) {
    const parts = params.month.split('-')
    if (parts.length === 2) {
      year = parseInt(parts[0], 10)
      month = parseInt(parts[1], 10) - 1
    }
  }

  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const data = await getBudgetData(user.id, monthStart)

  return (
    <BudgetPageClient
      initialData={data}
      year={year}
      month={month}
    />
  )
}
