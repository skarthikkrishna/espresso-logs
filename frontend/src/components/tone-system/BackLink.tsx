/**
 * BackLink — tone-aware back navigation link.
 *
 * Principle 4 (Warm Coherence): uses warm amber `.kk-tc-back-link` color
 * tokens — never default browser blue.
 * Principle 12 (No One-Offs): shared across all Shell-A pages; replaces
 * per-page inline `<Link className="kk-tc-back-link">` one-offs.
 */
import { Link } from 'react-router-dom'

interface BackLinkProps {
  to: string
  children?: string
}

export function BackLink({ to, children = '← Back' }: BackLinkProps) {
  return (
    <Link to={to} className="kk-tc-back-link">
      {children}
    </Link>
  )
}
