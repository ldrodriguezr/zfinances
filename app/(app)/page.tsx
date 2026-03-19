import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getBudgetData } from '@/lib/actions/budget-assign'
import { getAccountsWithBalances, getTransactionsForAccount } from '@/lib/actions/accounts'
import { ensureUserSeed } from '@/lib/actions/seed'
import Link from 'next/link'

function formatMoney(n: number) {
  const prefix = n < 0 ? '-' : ''
  return prefix + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(n))
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await ensureUserSeed(user.id)

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [budgetData, accounts, recentTx] = await Promise.all([
    getBudgetData(user.id, monthStart),
    getAccountsWithBalances(user.id),
    getTransactionsForAccount(user.id),
  ])

  const totalBalance = accounts.reduce((sum: number, a: any) => sum + a.balance, 0)
  const fundedGroups = budgetData.groups.filter((g) => g.available >= 0).length
  const totalGroups = budgetData.groups.length

  const last5 = recentTx.slice(0, 8)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        <p className="text-sm text-ynab-text-muted mt-1">Here&apos;s your financial snapshot</p>
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Ready to Assign */}
        <Link
          href="/budget"
          className={`rounded-xl border p-5 transition-colors hover:border-ynab-blue/50 ${
            budgetData.readyToAssign > 0
              ? 'bg-ynab-green/5 border-ynab-green/20'
              : budgetData.readyToAssign < 0
              ? 'bg-ynab-red/5 border-ynab-red/20'
              : 'bg-ynab-surface border-ynab-border'
          }`}
        >
          <p className="text-xs text-ynab-text-dim font-medium">Ready to Assign</p>
          <p className={`text-2xl font-bold tabular-nums mt-1 ${
            budgetData.readyToAssign > 0
              ? 'text-ynab-green'
              : budgetData.readyToAssign < 0
              ? 'text-ynab-red'
              : 'text-white'
          }`}>
            {formatMoney(budgetData.readyToAssign)}
          </p>
          <p className="text-[10px] text-ynab-text-dim mt-2">
            {budgetData.readyToAssign > 0
              ? 'Assign this money to categories'
              : budgetData.readyToAssign < 0
              ? 'Over-assigned! Move money back'
              : 'Every dollar has a job'}
          </p>
        </Link>

        {/* Total Balance */}
        <Link
          href="/accounts"
          className="rounded-xl border border-ynab-border bg-ynab-surface p-5 transition-colors hover:border-ynab-blue/50"
        >
          <p className="text-xs text-ynab-text-dim font-medium">Total Balance</p>
          <p className="text-2xl font-bold text-white tabular-nums mt-1">{formatMoney(totalBalance)}</p>
          <p className="text-[10px] text-ynab-text-dim mt-2">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </Link>

        {/* Categories Funded */}
        <Link
          href="/budget"
          className="rounded-xl border border-ynab-border bg-ynab-surface p-5 transition-colors hover:border-ynab-blue/50"
        >
          <p className="text-xs text-ynab-text-dim font-medium">Categories Funded</p>
          <p className="text-2xl font-bold text-white tabular-nums mt-1">
            {fundedGroups}<span className="text-base text-ynab-text-dim font-normal">/{totalGroups}</span>
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-ynab-border overflow-hidden">
            <div
              className="h-full rounded-full bg-ynab-green transition-all"
              style={{ width: totalGroups > 0 ? `${(fundedGroups / totalGroups) * 100}%` : '0%' }}
            />
          </div>
        </Link>
      </div>

      {/* Accounts overview */}
      <div className="rounded-xl border border-ynab-border bg-ynab-surface overflow-hidden">
        <div className="px-5 py-3 border-b border-ynab-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Accounts</h2>
          <Link href="/accounts" className="text-xs text-ynab-blue-light hover:underline">View all</Link>
        </div>
        <div className="divide-y divide-ynab-border/50">
          {accounts.map((acc: any) => (
            <div key={acc.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-ynab-text">{acc.name}</p>
                <p className="text-[10px] text-ynab-text-dim">
                  {acc.account_type === 'CREDIT' ? 'Credit Card' : 'Checking'} - {acc.currency}
                </p>
              </div>
              <span className={`text-sm font-semibold tabular-nums ${acc.balance >= 0 ? 'text-white' : 'text-ynab-red'}`}>
                {acc.balance < 0 ? '-' : ''}{formatMoney(acc.balance)}
              </span>
            </div>
          ))}
          {accounts.length === 0 && (
            <div className="px-5 py-6 text-center text-ynab-text-dim text-sm">
              No accounts yet. <Link href="/accounts" className="text-ynab-blue-light hover:underline">Add one</Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="rounded-xl border border-ynab-border bg-ynab-surface overflow-hidden">
        <div className="px-5 py-3 border-b border-ynab-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Recent Transactions</h2>
          <Link href="/accounts" className="text-xs text-ynab-blue-light hover:underline">View all</Link>
        </div>
        <div className="divide-y divide-ynab-border/50">
          {last5.map((tx: any) => (
            <div key={tx.id} className="px-5 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs text-ynab-text-dim w-12 shrink-0">{formatDate(tx.occurred_at)}</span>
                <span className="text-sm text-ynab-text truncate">{tx.merchant || tx.description || '—'}</span>
              </div>
              <span className={`text-sm font-semibold tabular-nums shrink-0 ml-3 ${
                tx.flow_type === 'EXPENSE' ? 'text-ynab-red' : 'text-ynab-green'
              }`}>
                {tx.flow_type === 'EXPENSE' ? '-' : '+'}{formatMoney(Number(tx.amount_home))}
              </span>
            </div>
          ))}
          {last5.length === 0 && (
            <div className="px-5 py-6 text-center text-ynab-text-dim text-sm">No transactions yet</div>
          )}
        </div>
      </div>
    </div>
  )
}
