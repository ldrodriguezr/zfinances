'use client'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function MonthPicker({
  year,
  month,
  onChange,
}: {
  year: number
  month: number
  onChange: (year: number, month: number) => void
}) {
  function prev() {
    if (month === 0) onChange(year - 1, 11)
    else onChange(year, month - 1)
  }
  function next() {
    if (month === 11) onChange(year + 1, 0)
    else onChange(year, month + 1)
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={prev}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-ynab-text-muted hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <h2 className="text-lg font-semibold text-white min-w-[160px] text-center">
        {MONTHS[month]} {year}
      </h2>

      <button
        onClick={next}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-ynab-text-muted hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
