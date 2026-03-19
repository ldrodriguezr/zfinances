'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-10 text-center">
      <h2 className="text-xl font-bold text-white">Something went wrong</h2>
      <p className="mt-2 text-ynab-text-muted text-sm max-w-md">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-lg bg-ynab-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-ynab-blue-light transition-colors"
      >
        Try Again
      </button>
    </div>
  )
}
