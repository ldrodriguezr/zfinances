'use client'

import { useState, useMemo } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts'

type Transaction = {
  id: string
  occurred_at: string
  flow_type: string
  amount_home: number
  category_level1_id: string | null
}

type Category = {
  id: string
  name: string
  level: number
  parent_category_id: string | null
  category_kind: string
}

type NetWorthSnapshot = {
  month_end: string
  assets_home_total: number
  liabilities_home_total: number
  net_worth_home_total: number
}

const CHART_COLORS = [
  '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#8b5cf6',
]

const TABS = ['Spending', 'Income vs Expense', 'Net Worth'] as const

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(n))
}

export default function ReportsPageClient({
  transactions,
  categories,
  accounts,
  netWorthSnapshots,
}: {
  transactions: Transaction[]
  categories: Category[]
  accounts: any[]
  netWorthSnapshots: NetWorthSnapshot[]
}) {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Spending')

  const categoryMap = useMemo(() => {
    const m = new Map<string, string>()
    categories.forEach((c) => m.set(c.id, c.name))
    return m
  }, [categories])

  const spendingByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const tx of transactions) {
      if (tx.flow_type !== 'EXPENSE') continue
      const catId = tx.category_level1_id || 'Uncategorized'
      const catName = tx.category_level1_id ? (categoryMap.get(tx.category_level1_id) || 'Unknown') : 'Uncategorized'
      map.set(catName, (map.get(catName) || 0) + Number(tx.amount_home))
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
  }, [transactions, categoryMap])

  const monthlyIncomeExpense = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>()
    for (const tx of transactions) {
      const month = tx.occurred_at.slice(0, 7)
      const entry = map.get(month) || { income: 0, expense: 0 }
      const amount = Number(tx.amount_home)
      if (tx.flow_type === 'INCOME') entry.income += amount
      else if (tx.flow_type === 'EXPENSE') entry.expense += amount
      map.set(month, entry)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        Income: Math.round(data.income),
        Expense: Math.round(data.expense),
      }))
  }, [transactions])

  const netWorthData = useMemo(() => {
    if (netWorthSnapshots.length > 0) {
      return netWorthSnapshots.map((s) => ({
        month: new Date(s.month_end).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        Assets: Math.round(Number(s.assets_home_total)),
        Liabilities: Math.round(Number(s.liabilities_home_total)),
        'Net Worth': Math.round(Number(s.net_worth_home_total)),
      }))
    }
    const totalAssets = accounts
      .filter((a) => a.account_type === 'LIQUIDITY')
      .reduce((sum: number, a: any) => sum + Math.max(0, a.balance), 0)
    const totalLiabilities = accounts
      .filter((a) => a.account_type === 'CREDIT')
      .reduce((sum: number, a: any) => sum + Math.abs(Math.min(0, a.balance)), 0)

    return [{
      month: 'Now',
      Assets: Math.round(totalAssets),
      Liabilities: Math.round(totalLiabilities),
      'Net Worth': Math.round(totalAssets - totalLiabilities),
    }]
  }, [netWorthSnapshots, accounts])

  const totalSpending = spendingByCategory.reduce((sum, c) => sum + c.value, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Reports</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-ynab-surface rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-ynab-blue text-white'
                : 'text-ynab-text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Spending */}
      {activeTab === 'Spending' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-ynab-border bg-ynab-surface p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Spending by Category</h3>
            {spendingByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={spendingByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {spendingByCategory.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatMoney(Number(value))}
                    contentStyle={{ background: '#1a2035', border: '1px solid #2a3352', borderRadius: '8px', color: '#e2e8f0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-ynab-text-dim text-sm">
                No spending data yet
              </div>
            )}
          </div>

          <div className="rounded-xl border border-ynab-border bg-ynab-surface p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Breakdown</h3>
            <div className="space-y-2">
              {spendingByCategory.map((cat, i) => {
                const pct = totalSpending > 0 ? (cat.value / totalSpending) * 100 : 0
                return (
                  <div key={cat.name} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="text-sm text-ynab-text flex-1 truncate">{cat.name}</span>
                    <span className="text-sm tabular-nums text-ynab-text-muted">{formatMoney(cat.value)}</span>
                    <span className="text-xs tabular-nums text-ynab-text-dim w-12 text-right">{pct.toFixed(0)}%</span>
                  </div>
                )
              })}
              {spendingByCategory.length === 0 && (
                <p className="text-sm text-ynab-text-dim">No spending data</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Income vs Expense */}
      {activeTab === 'Income vs Expense' && (
        <div className="rounded-xl border border-ynab-border bg-ynab-surface p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Income vs Expense</h3>
          {monthlyIncomeExpense.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={monthlyIncomeExpense} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3352" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => formatMoney(Number(v))} />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value))}
                  contentStyle={{ background: '#1a2035', border: '1px solid #2a3352', borderRadius: '8px', color: '#e2e8f0' }}
                />
                <Legend />
                <Bar dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-ynab-text-dim text-sm">
              No transaction data yet
            </div>
          )}
        </div>
      )}

      {/* Net Worth */}
      {activeTab === 'Net Worth' && (
        <div className="rounded-xl border border-ynab-border bg-ynab-surface p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Net Worth Over Time</h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={netWorthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3352" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v: number) => formatMoney(v)} />
              <Tooltip
                formatter={(value) => formatMoney(Number(value))}
                contentStyle={{ background: '#1a2035', border: '1px solid #2a3352', borderRadius: '8px', color: '#e2e8f0' }}
              />
              <Legend />
              <Line type="monotone" dataKey="Assets" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Liabilities" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Net Worth" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
