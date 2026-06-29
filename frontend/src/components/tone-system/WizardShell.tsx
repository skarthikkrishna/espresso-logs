/**
 * WizardShell — full-page scaffold for multi-step wizards.
 *
 * Mirrors FormPageShell's structural vocabulary with three key differences:
 * 1. Does NOT wrap the step body in a <form> — individual step bodies control
 *    their own form semantics.
 * 2. Adds a stepper slot between the DetailHeader and the step body.
 * 3. Accepts an optional aside slot for the field-guidance panel.
 *
 * spec-043 T023 — WizardShell component per aria-wizard-component-spec §1.
 */
import { useId, type ReactNode, type RefObject } from 'react'
import { BackLink } from './BackLink'
import { DetailHeader } from './DetailHeader'
import { TonePageWrapper } from './TonePageWrapper'
import { ToneToggle } from './ToneToggle'

export interface WizardShellProps {
  // ── Chrome ────────────────────────────────────────────────────────────────
  /** Passed to BackLink `to` prop. Required. */
  backTo: string

  // ── Header grammar (same vocabulary as FormPageShell) ────────────────────
  /** Eyebrow text above the title. */
  eyebrow?: ReactNode
  /** Page h1 text. Required. */
  title: ReactNode
  /** Guidance subtitle below the title. */
  subtitle?: ReactNode
  /** Optional status chips below the subtitle. */
  chips?: ReactNode

  // ── Stepper ───────────────────────────────────────────────────────────────
  /**
   * The progress stepper rendered between the header and the step body.
   * Pass a <ToneStepper> instance here. Required.
   */
  stepper: ReactNode

  // ── Step body ─────────────────────────────────────────────────────────────
  /** Current step body. Rendered in .kk-wizard-shell__body. */
  children: ReactNode

  /**
   * Optional sidebar panel. When provided, desktop layout renders a
   * two-column grid [2fr 1fr] with children in main and aside on the right.
   * Mobile: single column, aside rendered after children.
   */
  aside?: ReactNode

  // ── Status / error ────────────────────────────────────────────────────────
  /** Polite live region (file-pick count, row count, import progress). */
  status?: ReactNode
  /** Assertive alert region (import-level errors, not row-level). */
  errorSummary?: ReactNode

  // ── Actions ───────────────────────────────────────────────────────────────
  /**
   * Action cluster for the current step. Pass an <EntityFormActions> instance.
   * Renders in .kk-form-page__actions below the step body (not inside <form>).
   */
  actions?: ReactNode

  // ── Focus management ──────────────────────────────────────────────────────
  /**
   * Ref forwarded to the heading <span> so callers can call .focus() on step
   * transitions for accessible focus management (aria-wizard-component-spec §4.3).
   */
  headingRef?: RefObject<HTMLSpanElement | null>

  // ── IDs / testing ─────────────────────────────────────────────────────────
  /**
   * If provided, used as the id on the h1's inner span.
   * If omitted, WizardShell generates one with useId().
   */
  headingId?: string
  /** data-testid on the root TonePageWrapper div. */
  testId?: string
  /** Extra class(es) on the root TonePageWrapper div. */
  className?: string
}

export function WizardShell({
  backTo,
  eyebrow,
  title,
  subtitle,
  chips,
  stepper,
  children,
  aside,
  status,
  errorSummary,
  actions,
  headingRef,
  headingId,
  testId,
  className = '',
}: WizardShellProps) {
  const generatedId = useId()
  const resolvedHeadingId = headingId ?? `${generatedId}-heading`
  const resolvedStatusId = status ? `${generatedId}-status` : undefined
  const resolvedErrorId = errorSummary ? `${generatedId}-error` : undefined

  return (
    <TonePageWrapper
      testId={testId}
      className={['kk-form-page', 'kk-wizard-shell', className].filter(Boolean).join(' ')}
    >
      <div className="kk-b-page__nav kk-form-page__nav">
        <BackLink to={backTo} />
        <ToneToggle />
      </div>

      <div className="kk-detail-shell kk-form-page__shell kk-wizard-shell__shell">
        <DetailHeader
          eyebrow={eyebrow}
          title={
            <span
              id={resolvedHeadingId}
              ref={headingRef}
              tabIndex={-1}
              className="kk-wizard-shell__heading-focus-target"
            >
              {title}
            </span>
          }
          subtitle={subtitle}
          chips={chips}
        />

        {/* Stepper region — sits between header and step body */}
        <div className="kk-wizard-shell__stepper">{stepper}</div>

        {/* Status / error — same semantics as FormPageShell */}
        {status ? (
          <div
            id={resolvedStatusId}
            role="status"
            aria-live="polite"
            className="kk-form-page__status"
          >
            {status}
          </div>
        ) : null}

        {errorSummary ? (
          <div
            id={resolvedErrorId}
            role="alert"
            aria-live="assertive"
            className="kk-form-page__error"
          >
            {errorSummary}
          </div>
        ) : null}

        {/*
          Body + aside grid.
          When aside is present: desktop two-column grid; mobile single column.
          When aside is absent: single column at all viewports.
        */}
        <div
          className={
            aside
              ? 'kk-wizard-shell__content kk-wizard-shell__content--with-aside'
              : 'kk-wizard-shell__content'
          }
        >
          <div className="kk-wizard-shell__body">{children}</div>
          {aside ? <aside className="kk-wizard-shell__aside">{aside}</aside> : null}
        </div>

        {/* Actions — same placement as FormPageShell's .kk-form-page__actions */}
        {actions ? <div className="kk-form-page__actions">{actions}</div> : null}
      </div>
    </TonePageWrapper>
  )
}
