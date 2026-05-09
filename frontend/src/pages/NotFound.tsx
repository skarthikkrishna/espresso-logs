import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-6">
      <p className="text-7xl font-display text-amber-700/60">404</p>
      <h1 className="text-2xl font-display text-amber-100">Page not found</h1>
      <p className="text-amber-200/60 text-sm">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn bg-amber-600 hover:bg-amber-500 border-none text-white">
        Go home
      </Link>
    </div>
  )
}

