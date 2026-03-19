'use client'

import { useState, useTransition } from 'react'
import { assignToCategory } from '@/lib/actions/budget-assign'

type CategoryGroup = {
  id: string
  name: string
  assigned: number
  activity: number
  available: number
  categories: { id: string; name: string }[]
}

function formatMoney(n: number) {
  if (n === 0) return '—'
  const prefix = n < 0 ? '-' : ''
  return prefix + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(n))
}

function AvailablePill({ amount }: { amount: number }) {
  if (amount === 0) {
    return <span className="text-ynab-text-dim text-sm tabular-nums">—</span>
  }

  const color =
    amount > 0
      ? 'bg-ynab-green/15 text-ynab-green'
      : 'bg-ynab-red/15 text-ynab-red'

  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums ${color}`}>
      {formatMoney(amount)}
    </span>
  )
}

function AssignedCell({
  budgetId,
  categoryId,
  value,
}: {
  budgetId: string
  categoryId: string
  value: number
}) {
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState(value.toString())
  const [isPending, startTransition] = useTransition()

  function save() {
    const num = parseFloat(amount) || 0
    startTransition(async () => {
      await assignToCategory({ budgetId, categoryId, amount: num })
      setEditing(false)
    })
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        disabled={isPending}
        className="w-24 px-2 py-1 text-right text-sm bg-ynab-bg border border-ynab-blue rounded text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-ynab-blue"
      />
    )
  }

  return (
    <button
      onClick={() => { setAmount(value.toString()); setEditing(true) }}
      className="text-sm tabular-nums text-ynab-text hover:text-ynab-blue-light transition-colors cursor-text px-2 py-1 rounded hover:bg-white/5"
    >
      {formatMoney(value)}
    </button>
  )
}

export default function BudgetTable({
  groups,
  budgetId,
  assignedMap,
  activityMap,
}: {
  groups: CategoryGroup[]
  budgetId: string
  assignedMap: Record<string, number>
  activityMap: Record<string, number>
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggleGroup(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-[1fr_120px_120px_120px] gap-0 text-xs font-semibold text-ynab-text-dim uppercase tracking-wider px-4 py-2.5 border-b border-ynab-border bg-ynab-surface/50 sticky top-0 z-10">
        <div>Category</div>
        <div className="text-right">Assigned</div>
        <div className="text-right">Activity</div>
        <div className="text-right pr-1">Available</div>
      </div>

      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.id)
        const assigned = assignedMap[group.id] || 0
        const activity = activityMap[group.id] || 0
        const available = assigned + activity

        return (
          <div key={group.id}>
            <div
              onClick={() => toggleGroup(group.id)}
              className="grid grid-cols-[1fr_120px_120px_120px] gap-0 px-4 py-2.5 bg-ynab-surface2/50 border-b border-ynab-border cursor-pointer hover:bg-ynab-surface2/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg
                  className={`w-3.5 h-3.5 text-ynab-text-dim transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-sm font-semibold text-ynab-text">{group.name}</span>
              </div>
              <div className="text-right text-sm font-semibold text-ynab-text tabular-nums">
                {formatMoney(assigned)}
              </div>
              <div className="text-right text-sm font-semibold text-ynab-text-muted tabular-nums">
                {formatMoney(activity)}
              </div>
              <div className="text-right pr-1">
                <AvailablePill amount={available} />
              </div>
            </div>

            {!isCollapsed &&
              group.categories.map((cat) => (
                <div
                  key={cat.id}
                  className="grid grid-cols-[1fr_120px_120px_120px] gap-0 px-4 py-2 border-b border-ynab-border/50 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="pl-7 text-sm text-ynab-text-muted">{cat.name}</div>
                  <div className="text-right">
                    <AssignedCell
                      budgetId={budgetId}
                      categoryId={group.id}
                      value={assignedMap[group.id] || 0}
                    />
                  </div>
                  <div className="text-right text-sm text-ynab-text-dim tabular-nums py-1">
                    {formatMoney(activityMap[group.id] || 0)}
                  </div>
                  <div className="text-right pr-1 py-1">
                    <AvailablePill amount={(assignedMap[group.id] || 0) + (activityMap[group.id] || 0)} />
                  </div>
                </div>
              ))}
          </div>
        )
      })}

      {groups.length === 0 && (
        <div className="text-center py-12 text-ynab-text-dim">
          <p className="text-lg mb-2">No categories yet</p>
          <p className="text-sm">Categories will be created automatically when you first load the budget.</p>
        </div>
      )}
    </div>
  )
}
