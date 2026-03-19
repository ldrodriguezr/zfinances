'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import AddTransactionInline from '@/components/ynab/AddTransactionInline'
import { deleteTransaction } from '@/lib/actions/transactions'
import { createAccount } from '@/lib/actions/accounts'

type Account = {
  id: string
  name: string
  account_type: string
  currency: string
  balance: number
}

type Transaction = {
  id: string
  occurred_at: string
  merchant: string | null
  description: string | null
  flow_type: string
  amount_home: number
  amount_currency: number
  currency: string
  category_level1_id: string | null
  category_level2_id: string | null
}

type Category = {
  id: string
  name: string
  level: number
  parent_category_id: string | null
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(n))
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AccountsPageClient({
  accounts,
  transactions,
  categories,
  selectedAccountId,
}: {
  accounts: Account[]
  transactions: Transaction[]
  categories: Category[]
  selectedAccountId?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [newAccName, setNewAccName] = useState('')
  const [newAccType, setNewAccType] = useState<'LIQUIDITY' | 'CREDIT'>('LIQUIDITY')

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]))

  function selectAccount(id: string) {
    router.push(`/accounts?account=${id}`)
  }

  function handleAddAccount() {
    if (!newAccName.trim()) return
    startTransition(async () => {
      await createAccount({ name: newAccName.trim(), accountType: newAccType, currency: 'CRC' })
      setNewAccName('')
      setShowAddAccount(false)
      router.refresh()
    })
  }

  function handleDeleteTx(id: string) {
    if (!confirm('Delete this transaction?')) return
    startTransition(async () => {
      await deleteTransaction(id)
      router.refresh()
    })
  }

  return (
    <div className="flex h-full">
      {/* Account list sidebar */}
      <div className="w-[240px] shrink-0 border-r border-ynab-border bg-ynab-surface/30 flex flex-col">
        <div className="px-4 py-3 border-b border-ynab-border">
          <p className="text-xs font-semibold text-ynab-text-dim uppercase tracking-wider">Accounts</p>
          <p className="text-lg font-bold text-white tabular-nums mt-0.5">
            {formatMoney(totalBalance)}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {accounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => selectAccount(acc.id)}
              className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors ${
                acc.id === selectedAccountId
                  ? 'bg-ynab-blue/10 border-l-2 border-ynab-blue'
                  : 'hover:bg-white/5 border-l-2 border-transparent'
              }`}
            >
              <div>
                <p className="text-sm font-medium text-ynab-text">{acc.name}</p>
                <p className="text-[10px] text-ynab-text-dim">
                  {acc.account_type === 'CREDIT' ? 'Credit Card' : 'Checking'} - {acc.currency}
                </p>
              </div>
              <span className={`text-sm tabular-nums font-semibold ${acc.balance >= 0 ? 'text-ynab-text' : 'text-ynab-red'}`}>
                {acc.balance < 0 ? '-' : ''}{formatMoney(acc.balance)}
              </span>
            </button>
          ))}
        </div>

        <div className="px-3 py-2 border-t border-ynab-border">
          {showAddAccount ? (
            <div className="space-y-2">
              <input
                autoFocus
                placeholder="Account name"
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddAccount() }}
                className="w-full px-2 py-1.5 text-sm bg-ynab-bg border border-ynab-border rounded text-white focus:outline-none focus:border-ynab-blue"
              />
              <select
                value={newAccType}
                onChange={(e) => setNewAccType(e.target.value as any)}
                className="w-full px-2 py-1.5 text-sm bg-ynab-bg border border-ynab-border rounded text-white"
              >
                <option value="LIQUIDITY">Checking/Cash</option>
                <option value="CREDIT">Credit Card</option>
              </select>
              <div className="flex gap-1">
                <button onClick={handleAddAccount} disabled={isPending} className="flex-1 px-2 py-1.5 rounded bg-ynab-blue text-white text-xs font-semibold">
                  {isPending ? '...' : 'Add'}
                </button>
                <button onClick={() => setShowAddAccount(false)} className="px-2 py-1.5 rounded text-ynab-text-dim text-xs hover:bg-white/5">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddAccount(true)}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-2 text-xs text-ynab-blue-light hover:bg-white/5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Account
            </button>
          )}
        </div>
      </div>

      {/* Transaction register */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 px-4 py-3 border-b border-ynab-border bg-ynab-surface/20 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            {accounts.find((a) => a.id === selectedAccountId)?.name || 'All Accounts'}
          </h2>
        </div>

        {selectedAccountId && (
          <div className="shrink-0">
            <AddTransactionInline
              accountId={selectedAccountId}
              categories={categories}
            />
          </div>
        )}

        {/* Table header */}
        <div className="shrink-0 grid grid-cols-[100px_1fr_1fr_1fr_100px_100px] gap-0 text-[11px] font-semibold text-ynab-text-dim uppercase tracking-wider px-4 py-2 border-b border-ynab-border bg-ynab-surface/30">
          <div>Date</div>
          <div>Payee</div>
          <div>Category</div>
          <div>Memo</div>
          <div className="text-right">Outflow</div>
          <div className="text-right">Inflow</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {transactions.map((tx) => {
            const catName = tx.category_level1_id
              ? categoryMap.get(tx.category_level1_id)
              : tx.category_level2_id
              ? categoryMap.get(tx.category_level2_id)
              : null

            const isOutflow = tx.flow_type === 'EXPENSE'
            const amount = Number(tx.amount_home)

            return (
              <div
                key={tx.id}
                className="group grid grid-cols-[100px_1fr_1fr_1fr_100px_100px] gap-0 px-4 py-2 border-b border-ynab-border/30 hover:bg-white/[0.02] transition-colors items-center"
              >
                <div className="text-sm text-ynab-text-muted">{formatDate(tx.occurred_at)}</div>
                <div className="text-sm text-ynab-text truncate">{tx.merchant || tx.description || '—'}</div>
                <div className="text-sm text-ynab-text-muted truncate">{catName || '—'}</div>
                <div className="text-sm text-ynab-text-dim truncate">{tx.description || '—'}</div>
                <div className="text-right text-sm tabular-nums">
                  {isOutflow ? (
                    <span className="text-ynab-red">{formatMoney(amount)}</span>
                  ) : (
                    <span className="text-ynab-text-dim">—</span>
                  )}
                </div>
                <div className="text-right text-sm tabular-nums flex items-center justify-end gap-2">
                  {!isOutflow ? (
                    <span className="text-ynab-green">{formatMoney(amount)}</span>
                  ) : (
                    <span className="text-ynab-text-dim">—</span>
                  )}
                  <button
                    onClick={() => handleDeleteTx(tx.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-ynab-text-dim hover:text-ynab-red transition-all"
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}

          {transactions.length === 0 && (
            <div className="text-center py-16 text-ynab-text-dim">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">No transactions yet</p>
              <p className="text-xs mt-1">Click &quot;Add Transaction&quot; to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
