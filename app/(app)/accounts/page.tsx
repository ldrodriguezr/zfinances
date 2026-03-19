import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getAccountsWithBalances, getTransactionsForAccount } from '@/lib/actions/accounts'
import { getAllCategories } from '@/lib/actions/categories'
import { ensureUserSeed } from '@/lib/actions/seed'
import AccountsPageClient from './AccountsPageClient'

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await ensureUserSeed(user.id)

  const params = await searchParams
  const accounts = await getAccountsWithBalances(user.id)
  const selectedAccountId = params.account || (accounts[0]?.id ?? undefined)
  const transactions = await getTransactionsForAccount(user.id, selectedAccountId)
  const categories = await getAllCategories(user.id)

  return (
    <AccountsPageClient
      accounts={accounts}
      transactions={transactions}
      categories={categories}
      selectedAccountId={selectedAccountId}
    />
  )
}
