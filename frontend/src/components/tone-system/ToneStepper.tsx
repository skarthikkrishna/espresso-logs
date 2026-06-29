/**
 * ToneStepper — reusable step-progress indicator.
 *
 * Replaces the inline ImportStepper function in ImportWizard.tsx.
 * Uses only canonical --kk-* tokens; no raw amber/emerald literals.
 * Three states: completed, current (aria-current="step"), upcoming.
 *
 * Horizontal layout at all viewports including 360px — each segment
 * uses flex:1 1 0 + min-width:0 so labels truncate rather than overflow.
 *
 * spec-043 T023 — ToneStepper per aria-wizard-component-spec §2.
 */

/** CheckIcon — extracted from ImportWizard.tsx; aria-hidden, currentColor fill. */
function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      style={{ width: '0.875rem', height: '0.875rem' }}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.3a1 1 0 0 1-1.42.006l-3.3-3.3a1 1 0 1 1 1.414-1.414l2.59 2.59 6.494-6.59a1 1 0 0 1 1.416-.006Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export interface ToneStepperProps {
  /**
   * Human-readable label for each step, in order.
   * Length determines total step count. Minimum 2, maximum 5.
   */
  stepLabels: readonly string[]

  /**
   * Currently active step, 1-indexed.
   * Steps < currentStep are rendered as completed.
   * Steps > currentStep are rendered as upcoming.
   */
  currentStep: number

  /**
   * Accessible label for the <nav> landmark.
   * Recommended: "Import progress" (matches COPY.import.progressAria).
   */
  'aria-label': string

  className?: string
}

export function ToneStepper({
  stepLabels,
  currentStep,
  'aria-label': ariaLabel,
  className,
}: ToneStepperProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={['kk-tone-stepper', className].filter(Boolean).join(' ')}
    >
      <ol className="kk-tone-stepper__list">
        {stepLabels.map((label, i) => {
          const n = i + 1
          const isCurrent = currentStep === n
          const isCompleted = currentStep > n

          const stepClass = isCurrent
            ? 'kk-tone-stepper__step--current'
            : isCompleted
              ? 'kk-tone-stepper__step--completed'
              : 'kk-tone-stepper__step--upcoming'

          const markerClass = isCurrent
            ? 'kk-tone-stepper__marker--current'
            : isCompleted
              ? 'kk-tone-stepper__marker--completed'
              : 'kk-tone-stepper__marker--upcoming'

          const srStatus = isCompleted
            ? '(completed)'
            : isCurrent
              ? '(current step)'
              : '(upcoming)'

          return (
            <li
              key={label}
              aria-current={isCurrent ? 'step' : undefined}
              className={`kk-tone-stepper__step ${stepClass}`}
            >
              <span className={`kk-tone-stepper__marker ${markerClass}`} aria-hidden="true">
                {isCompleted ? <CheckIcon /> : n}
              </span>
              <span className="kk-tone-stepper__label">{label}</span>
              <span className="kk-tone-stepper__sr-status">{srStatus}</span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
