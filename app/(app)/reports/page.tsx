import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getAllCategories } from '@/lib/actions/categories'
import { getAccountsWithBalances } from '@/lib/actions/accounts'
import ReportsPageClient from './ReportsPageClient'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const categories = await getAllCategories(user.id)
  const accounts = await getAccountsWithBalances(user.id)

  const now = new Date()
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, occurred_at, flow_type, amount_home, category_level1_id')
    .eq('user_id', user.id)
    .gte('occurred_at', sixMonthsAgo.toISOString().slice(0, 10))
    .order('occurred_at', { ascending: true })

  const { data: netWorthSnapshots } = await supabase
    .from('net_worth_snapshots')
    .select('month_end, assets_home_total, liabilities_home_total, net_worth_home_total')
    .eq('user_id', user.id)
    .order('month_end', { ascending: true })
    .limit(12)

  return (
    <ReportsPageClient
      transactions={transactions ?? []}
      categories={categories}
      accounts={accounts}
      netWorthSnapshots={netWorthSnapshots ?? []}
    />
  )
}
