/**
 * ListPageHeader — title + optional descriptor for immersive list pages.
 *
 * Standard shape is 2 lines: a large display-font title (dominant anchor)
 * and a single descriptor below it (e.g. "BEANS / INVENTORY"). This covers
 * all current list routes (Catalog, Hardware, etc.).
 *
 * Principle 6 (Typography Hierarchy): title is the dominant visual anchor
 * (large, bold, primary color); section is a quiet label (small-caps,
 * secondary color). Eyebrow is available but not used in standard list pages.
 * Principle 1 (Dual-Tone Surface): all text colors resolve via --kk-il-*
 * tokens set by the enclosing ImmersiveListShell's [data-tone] attribute.
 * Principle 12 (No One-Offs): replaces PageHeader + SectionHeading pair
 * for immersive list routes.
 */
import type { ReactNode } from 'react'

interface ListPageHeaderProps {
  /** Eyebrow line — rarely used; omit for the standard 2-line layout. */
  eyebrow?: string
  /** Page title — e.g. "Catalog". Rendered large + bold (display font). */
  title: string
  /** Descriptor below the title — e.g. "BEANS / INVENTORY". This is the
   *  standard second line for list pages; rendered uppercase + tracked. */
  section?: string
  className?: string
  /** Optional data-testid forwarded to the section label element. */
  sectionTestId?: string
  children?: ReactNode
}

export function ListPageHeader({
  eyebrow,
  title,
  section,
  className = '',
  sectionTestId,
  children,
}: ListPageHeaderProps) {
  return (
    <header className={['list-page-header', className].filter(Boolean).join(' ')}>
      {eyebrow && (
        <p className="list-page-header-eyebrow">{eyebrow}</p>
      )}
      <h1 className="list-page-header-title">{title}</h1>
      {section && (
        <p
          className="list-page-header-section"
          data-testid={sectionTestId}
        >
          {section}
        </p>
      )}
      {children}
    </header>
  )
}
