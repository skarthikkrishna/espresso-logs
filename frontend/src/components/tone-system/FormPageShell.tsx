import { useId, type FormEventHandler, type ReactNode } from 'react'
import { BackLink } from './BackLink'
import { DetailHeader } from './DetailHeader'
import { TonePageWrapper } from './TonePageWrapper'
import { ToneToggle } from './ToneToggle'

export interface FormPageShellProps {
  backTo: string
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  media?: ReactNode
  chips?: ReactNode
  status?: ReactNode
  errorSummary?: ReactNode
  children: ReactNode
  actions?: ReactNode
  headingId?: string
  formId?: string
  onSubmit?: FormEventHandler<HTMLFormElement>
  className?: string
  formClassName?: string
  testId?: string
}

function describedBy(...ids: Array<string | undefined>): string | undefined {
  const presentIds = ids.filter(Boolean)
  return presentIds.length > 0 ? presentIds.join(' ') : undefined
}

export function FormPageShell({
  backTo,
  eyebrow,
  title,
  subtitle,
  media,
  chips,
  status,
  errorSummary,
  children,
  actions,
  headingId,
  formId,
  onSubmit,
  className = '',
  formClassName = '',
  testId,
}: FormPageShellProps) {
  const generatedId = useId()
  const resolvedHeadingId = headingId ?? `${generatedId}-heading`
  const resolvedStatusId = status ? `${generatedId}-status` : undefined
  const resolvedErrorId = errorSummary ? `${generatedId}-error` : undefined

  return (
    <TonePageWrapper
      testId={testId}
      className={['kk-form-page', className].filter(Boolean).join(' ')}
    >
      <div className="kk-b-page__nav kk-form-page__nav">
        <BackLink to={backTo} />
        <ToneToggle />
      </div>

      <div className="kk-detail-shell kk-form-page__shell">
        <DetailHeader
          eyebrow={eyebrow}
          title={<span id={resolvedHeadingId}>{title}</span>}
          subtitle={subtitle}
          media={media}
          chips={chips}
        />

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

        <form
          id={formId}
          aria-labelledby={resolvedHeadingId}
          aria-describedby={describedBy(resolvedStatusId, resolvedErrorId)}
          noValidate
          onSubmit={onSubmit}
          className={['kk-form-page__form', formClassName].filter(Boolean).join(' ')}
        >
          <div className="kk-form-page__body">{children}</div>
          {actions ? <div className="kk-form-page__actions">{actions}</div> : null}
        </form>
      </div>
    </TonePageWrapper>
  )
}
