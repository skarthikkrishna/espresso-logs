export default function LoadingSpinner({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4">
      <span className="loading loading-spinner loading-lg text-amber-400" />
      <p className="text-amber-200/70 text-sm">{message}</p>
    </div>
  )
}
