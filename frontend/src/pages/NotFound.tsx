import { Link } from 'react-router-dom'
import { COPY } from '../copy'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="kaapi-content-surface w-full max-w-md p-8 text-center space-y-6">
        <p className="text-7xl font-display text-[var(--kaapi-content-muted)]">{COPY.notFound.code}</p>
        <h1 className="text-2xl font-display text-[var(--kaapi-content-content)]">{COPY.notFound.title}</h1>
        <p className="text-[var(--kaapi-content-muted)] text-sm">{COPY.notFound.body}</p>
        <Link to="/" className="btn btn-primary btn-bevel no-underline">
          {COPY.notFound.goHome}
        </Link>
      </div>
    </div>
  )
}

