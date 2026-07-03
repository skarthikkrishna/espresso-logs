import type { ReactNode } from 'react'

export type ToneStateCardState =
  | 'empty'
  | 'loading'
  | 'error'
  | 'success'
  | 'info'
  | 'warning'
  | 'not-found'
  | 'readonly'

type ToneStateCardLive = boolean | 'polite' | 'assertive' | 'off'

interface ToneStateCardProps {
  state: ToneStateCardState
  title: string
  message?: ReactNode
  action?: ReactNode
  compact?: boolean
  live?: ToneStateCardLive
  className?: string
  children?: ReactNode
  'data-testid'?: string
}

const STATE_ICON: Record<ToneStateCardState, string> = {
  empty: '○',
  loading: '⋯',
  error: '!',
  success: '✓',
  info: 'i',
  warning: '!',
  'not-found': '404',
  readonly: '↘',
}

const STATE_LABEL: Record<ToneStateCardState, string> = {
  empty: 'Empty',
  loading: 'Loading',
  error: 'Error',
  success: 'Success',
  info: 'Information',
  warning: 'Warning',
  'not-found': 'Not found',
  readonly: 'Read only',
}

function roleForState(state: ToneStateCardState): 'alert' | 'status' | undefined {
  if (state === 'error' || state === 'warning') return 'alert'
  if (state === 'loading' || state === 'success' || state === 'info') return 'status'
  return undefined
}

function ariaLiveForState(state: ToneStateCardState, live?: ToneStateCardLive): 'polite' | 'assertive' | 'off' | undefined {
  if (live === true) return state === 'error' || state === 'warning' ? 'assertive' : 'polite'
  if (live === false) return 'off'
  if (live) return live
  if (state === 'error' || state === 'warning') return 'assertive'
  if (state === 'loading' || state === 'success' || state === 'info') return 'polite'
  return undefined
}

export function ToneStateCard({
  state,
  title,
  message,
  action,
  compact = false,
  live,
  className = '',
  children,
  'data-testid': testId,
}: ToneStateCardProps) {
  const role = roleForState(state)
  const ariaLive = ariaLiveForState(state, live)

  return (
    <section
      role={role}
      aria-live={ariaLive}
      aria-busy={state === 'loading' ? true : undefined}
      data-state={state}
      data-testid={testId}
      className={[
        'tone-state-card',
        `tone-state-card--${state}`,
        compact ? 'tone-state-card--compact' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="tone-state-card__accent" aria-hidden="true" />
      <div className="tone-state-card__icon" aria-hidden="true">
        {STATE_ICON[state]}
      </div>
      <div className="tone-state-card__body">
        <p className="sr-only">{STATE_LABEL[state]}</p>
        <h2 className="tone-state-card__title">{title}</h2>
        {message ? <div className="tone-state-card__message">{message}</div> : null}
        {state === 'loading' && !children ? (
          <div className="tone-state-card__skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : children}
        {action ? <div className="tone-state-card__action">{action}</div> : null}
      </div>
    </section>
  )
}
