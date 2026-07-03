import type { HTMLAttributes } from 'react'
import { COPY } from '../../copy'
import { ToneButton } from '../tone-system/ToneButton'

interface PaginationProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  siblingCount?: number
}

const ELLIPSIS = '…'

/**
 * spec-043 T005 — shared Pagination primitive.
 *
 * Built entirely from {@link ToneButton} so it inherits the tone-system
 * Smooth Bevel/focus contract.
 * Rendered in normal document flow — never fixed or sticky — so it sits below the
 * list it pages. A windowed page list keeps the control compact and overflow-free at
 * 360px. Previous/Next labels come from the operator copy registry; numbered controls
 * expose data values (page numbers), not copy.
 */
function buildPageWindow(page: number, pageCount: number, siblingCount: number): (number | typeof ELLIPSIS)[] {
  const window: (number | typeof ELLIPSIS)[] = []
  const first = 1
  const last = pageCount
  const start = Math.max(first, page - siblingCount)
  const end = Math.min(last, page + siblingCount)

  if (start > first) {
    window.push(first)
    if (start > first + 1) window.push(ELLIPSIS)
  }
  for (let p = start; p <= end; p += 1) window.push(p)
  if (end < last) {
    if (end < last - 1) window.push(ELLIPSIS)
    window.push(last)
  }
  return window
}

export default function Pagination({
  page,
  pageCount,
  onPageChange,
  siblingCount = 1,
  className = '',
  ...props
}: PaginationProps) {
  if (pageCount <= 1) return null

  const clampedPage = Math.min(Math.max(page, 1), pageCount)
  const pages = buildPageWindow(clampedPage, pageCount, siblingCount)

  return (
    <nav
      aria-label={COPY.pagination.label}
      className={['tone-pagination', className].filter(Boolean).join(' ')}
      {...props}
    >
      <ToneButton
        variant="edit"
        onClick={() => onPageChange(clampedPage - 1)}
        disabled={clampedPage <= 1}
      >
        {COPY.pagination.previous}
      </ToneButton>

      <ul className="tone-pagination__pages">
        {pages.map((entry, index) =>
          entry === ELLIPSIS ? (
            <li key={`gap-${index}`} aria-hidden="true" className="tone-pagination__ellipsis">
              {ELLIPSIS}
            </li>
          ) : (
            <li key={entry}>
              <ToneButton
                variant={entry === clampedPage ? 'primary' : 'ghost'}
                onClick={() => onPageChange(entry)}
                aria-current={entry === clampedPage ? 'page' : undefined}
                className="tone-pagination__page"
              >
                {entry}
              </ToneButton>
            </li>
          ),
        )}
      </ul>

      <ToneButton
        variant="edit"
        onClick={() => onPageChange(clampedPage + 1)}
        disabled={clampedPage >= pageCount}
      >
        {COPY.pagination.next}
      </ToneButton>
    </nav>
  )
}
