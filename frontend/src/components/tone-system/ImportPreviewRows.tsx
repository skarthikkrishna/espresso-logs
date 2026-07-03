/**
 * ImportPreviewRows — canonical display component for the parsed CSV preview table.
 *
 * Replaces the inline row-grid in ImportWizard.tsx step 2.
 * Mobile: stacked row cards (no horizontal scroll).
 * Desktop (≥768px): four-column grid (3rem 8rem 1fr auto).
 *
 * Uses Chip from tone-system for type/status chips so all colours resolve
 * through the canonical --kk-chip-* token family.
 *
 * spec-043 T023 — ImportPreviewRows per aria-wizard-component-spec §3.
 */
import { Chip } from './Chip'
import { COPY } from '../../copy'

/** Shared ParsedRow type — re-exported for ImportWizard.tsx to consume. */
export interface ParsedRow {
  raw: Record<string, string>
  errors: string[]
  type: 'catalog' | 'brew-log' | 'unknown'
}

export interface ImportPreviewRowsProps {
  rows: ParsedRow[]
  /**
   * When provided, renders a summary line above the table.
   * If omitted, no summary line is rendered — the parent renders it separately.
   */
  validCount?: number
  invalidCount?: number
  className?: string
}

/** Derive a human-readable summary from the raw CSV row per spec §3.4. */
function deriveRowSummary(row: ParsedRow): string {
  if (row.type === 'catalog') {
    return `${row.raw.roaster ?? '—'} — ${row.raw.bean_name ?? '—'}`
  }
  if (row.type === 'brew-log') {
    const base = row.raw.bag_display ?? '—'
    return row.raw.date ? `${base} · ${row.raw.date}` : base
  }
  // unknown — first 2 non-empty raw values joined with ·
  const nonEmpty = Object.values(row.raw).filter(Boolean).slice(0, 2)
  return nonEmpty.length > 0 ? nonEmpty.join(' · ') : '—'
}

export function ImportPreviewRows({
  rows,
  validCount,
  invalidCount,
  className,
}: ImportPreviewRowsProps) {
  if (rows.length === 0) {
    return (
      <div className={['kk-import-preview', 'kk-import-preview--empty', className].filter(Boolean).join(' ')}>
        <div className="kk-import-preview__empty">
          <span aria-hidden="true" className="kk-import-preview__empty-icon">
            📄
          </span>
          <p className="kk-import-preview__empty-title">{COPY.import.unlockPreviewTitle}</p>
          <p className="kk-import-preview__empty-body">{COPY.import.unlockPreviewBody}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={['kk-import-preview', className].filter(Boolean).join(' ')}>
      {validCount !== undefined && invalidCount !== undefined ? (
        <p className="kk-import-preview__summary">
          {COPY.import.validityCount(validCount, invalidCount)}
        </p>
      ) : null}

      {/* Header row — hidden on mobile via CSS, visible on md+ */}
      <div className="kk-import-preview__header-row" aria-hidden="true">
        <span>#</span>
        <span>{COPY.import.colType}</span>
        <span>{COPY.import.colSummary}</span>
        <span>{COPY.import.colStatus}</span>
      </div>

      {rows.map((row, i) => {
        const ok = row.errors.length === 0
        const summary = deriveRowSummary(row)
        const extraErrors = row.errors.length - 1

        return (
          <div
            key={i}
            className={[
              'kk-import-preview__row',
              !ok ? 'kk-import-preview__row--error' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {/* Row number */}
            <span className="kk-import-preview__cell kk-import-preview__cell--index">
              <span className="kk-import-preview__mobile-label" aria-hidden="true">
                {COPY.import.rowLabel}{' '}
              </span>
              {i + 1}
            </span>

            {/* Type chip — neutral token family */}
            <div className="kk-import-preview__cell kk-import-preview__cell--type">
              <Chip variant="default">{row.type}</Chip>
            </div>

            {/* Summary */}
            <p
              className="kk-import-preview__cell kk-import-preview__cell--summary"
              title={summary}
            >
              {summary}
            </p>

            {/* Status chip — success or danger token family */}
            <div className="kk-import-preview__cell kk-import-preview__cell--status">
              {ok ? (
                <Chip variant="status-active">{COPY.import.ready}</Chip>
              ) : (
                <Chip variant="danger">{COPY.import.needsFix}</Chip>
              )}
            </div>

            {/* Error message — full-width, only when errors present */}
            {!ok ? (
              <p
                data-testid="import-validation-message"
                className="kk-import-preview__error-text"
              >
                {row.errors[0]}
                {extraErrors > 0 ? ` (+${extraErrors} more)` : ''}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
