export default function ReadyToAssign({ amount, currency }: { amount: number; currency?: string }) {
  const isPositive = amount > 0
  const isNegative = amount < 0
  const isZero = amount === 0

  const bgColor = isPositive
    ? 'bg-ynab-green/15 border-ynab-green/30'
    : isNegative
    ? 'bg-ynab-red/15 border-ynab-red/30'
    : 'bg-ynab-surface2 border-ynab-border'

  const textColor = isPositive
    ? 'text-ynab-green'
    : isNegative
    ? 'text-ynab-red'
    : 'text-ynab-text-muted'

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount))

  return (
    <div className={`px-5 py-3 rounded-xl border ${bgColor} flex items-center gap-3`}>
      <div>
        <p className="text-xs text-ynab-text-muted font-medium">Ready to Assign</p>
        <p className={`text-2xl font-bold tabular-nums ${textColor}`}>
          {isNegative ? '-' : ''}{formatted}
        </p>
      </div>
      {isPositive && (
        <p className="text-xs text-ynab-text-dim ml-auto">
          Assign this money to your categories
        </p>
      )}
      {isNegative && (
        <p className="text-xs text-ynab-red/70 ml-auto">
          You assigned more than you have
        </p>
      )}
      {isZero && (
        <p className="text-xs text-ynab-text-dim ml-auto">
          Every dollar has a job!
        </p>
      )}
    </div>
  )
}
