'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import MonthPicker from '@/components/ynab/MonthPicker'
import ReadyToAssign from '@/components/ynab/ReadyToAssign'
import BudgetTable from '@/components/ynab/BudgetTable'

type BudgetData = {
  budget: { id: string }
  readyToAssign: number
  totalIncome: number
  totalAssigned: number
  groups: Array<{
    id: string
    name: string
    assigned: number
    activity: number
    available: number
    categories: { id: string; name: string }[]
  }>
  assignedMap: Record<string, number>
  activityMap: Record<string, number>
}

export default function BudgetPageClient({
  initialData,
  year,
  month,
}: {
  initialData: BudgetData
  year: number
  month: number
}) {
  const router = useRouter()

  function handleMonthChange(y: number, m: number) {
    const param = `${y}-${String(m + 1).padStart(2, '0')}`
    router.push(`/budget?month=${param}`)
  }

  const totalAssigned = Object.values(initialData.assignedMap).reduce((s, v) => s + v, 0)
  const totalActivity = Object.values(initialData.activityMap).reduce((s, v) => s + v, 0)
  const totalAvailable = totalAssigned + totalActivity

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-6 py-4 border-b border-ynab-border bg-ynab-surface/30 flex items-center justify-between gap-4">
        <MonthPicker year={year} month={month} onChange={handleMonthChange} />
        <ReadyToAssign amount={initialData.readyToAssign} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <BudgetTable
          groups={initialData.groups}
          budgetId={initialData.budget.id}
          assignedMap={initialData.assignedMap}
          activityMap={initialData.activityMap}
        />

        <div className="grid grid-cols-[1fr_120px_120px_120px] gap-0 px-4 py-3 bg-ynab-surface2/30 border-t border-ynab-border sticky bottom-0">
          <div className="text-sm font-semibold text-ynab-text-muted">Total</div>
          <div className="text-right text-sm font-bold text-white tabular-nums">
            {totalAssigned.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-right text-sm font-bold text-ynab-text-muted tabular-nums">
            {totalActivity.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-right text-sm font-bold tabular-nums pr-1">
            <span className={totalAvailable >= 0 ? 'text-ynab-green' : 'text-ynab-red'}>
              {totalAvailable.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
