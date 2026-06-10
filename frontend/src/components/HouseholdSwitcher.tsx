import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AccessibleDialog from './AccessibleDialog'
import type { Membership } from '../types/entities'

interface HouseholdSwitcherProps {
  variant: 'desktop' | 'mobile'
}

const truncateHouseholdName = (name: string): string =>
  name.length > 24 ? `${name.slice(0, 21)}…` : name

const memberCountLabel = (membership: Membership): string => {
  if (membership.member_count == null) return 'Members unavailable'
  return `${membership.member_count} member${membership.member_count === 1 ? '' : 's'}`
}

function HouseholdOption({
  membership,
  active,
  disabled,
  onSelect,
}: {
  membership: Membership
  active: boolean
  disabled: boolean
  onSelect: (membership: Membership) => void
}) {
  return (
    <button
      type="button"
      disabled={disabled || active}
      className="btn btn-ghost min-h-14 h-auto w-full justify-between rounded-xl px-3 py-2 text-left disabled:opacity-80"
      onClick={() => onSelect(membership)}
      aria-current={active ? 'true' : undefined}
      title={membership.household_name}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm text-amber-100">{membership.household_name}</span>
        <span className="block text-xs text-base-content/55">{memberCountLabel(membership)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="badge badge-outline badge-sm capitalize">{membership.role}</span>
        {active ? <span className="text-amber-300" aria-label="Active household">✓</span> : null}
      </span>
    </button>
  )
}

export default function HouseholdSwitcher({ variant }: HouseholdSwitcherProps) {
  const { memberships, activeHouseholdId, activeMembership, switchHousehold } = useAuth()
  const [open, setOpen] = useState(false)
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [error, setError] = useState<string | null>(null)
  const popoverId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)

  const hasMultipleHouseholds = memberships.length > 1
  const current = activeMembership ?? memberships.find((membership) => membership.household_id === activeHouseholdId) ?? memberships[0]

  useEffect(() => {
    if (!open || variant !== 'desktop') return undefined
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, variant])

  if (!current) return null

  const selectHousehold = async (membership: Membership) => {
    if (membership.household_id === activeHouseholdId) return
    setError(null)
    setSwitchingTo(membership.household_id)
    setAnnouncement(`Switching to ${membership.household_name}…`)
    try {
      await switchHousehold(membership.household_id)
      setAnnouncement(`Switched to ${membership.household_name}.`)
      setOpen(false)
      triggerRef.current?.focus()
    } catch {
      setError('Could not switch household. Check your connection and try again.')
      setAnnouncement('Household switch failed.')
    } finally {
      setSwitchingTo(null)
    }
  }

  if (variant === 'desktop') {
    if (!hasMultipleHouseholds) return null
    return (
      <div className="relative px-3 pb-3">
        <button
          ref={triggerRef}
          type="button"
          className="btn btn-outline btn-bevel min-h-14 h-auto w-full justify-between px-3 text-left"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={popoverId}
          onClick={() => setOpen((value) => !value)}
          title={current.household_name}
        >
          <span className="min-w-0">
            <span className="block truncate text-sm text-amber-100">{truncateHouseholdName(current.household_name)}</span>
            <span className="block text-xs text-base-content/55">{memberCountLabel(current)}</span>
          </span>
          <span className="badge badge-outline badge-sm capitalize">{current.role}</span>
        </button>
        {open ? (
          <div
            id={popoverId}
            role="menu"
            className="absolute left-3 right-3 top-full z-50 mt-2 rounded-xl border border-amber-900/40 bg-stone-950 p-2 shadow-2xl"
          >
            <div className="space-y-1">
              {memberships.map((membership) => (
                <HouseholdOption
                  key={membership.household_id}
                  membership={membership}
                  active={membership.household_id === activeHouseholdId}
                  disabled={switchingTo != null}
                  onSelect={selectHousehold}
                />
              ))}
              <Link to="/household/new" className="btn btn-ghost min-h-11 w-full justify-start text-amber-300 no-underline" onClick={() => setOpen(false)}>
                + Create new household
              </Link>
            </div>
            {error ? <p className="mt-2 px-2 text-xs text-error" role="alert">{error}</p> : null}
          </div>
        ) : null}
        <p className="sr-only" aria-live="polite">{announcement}</p>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {hasMultipleHouseholds ? (
        <button
          ref={triggerRef}
          type="button"
          className="btn btn-ghost min-h-11 h-auto min-w-0 flex-1 justify-start px-2 text-left"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          title={current.household_name}
        >
          <span className="min-w-0">
            <span className="block truncate text-xs uppercase tracking-[0.16em] text-base-content/45">Household</span>
            <span className="block truncate text-sm text-amber-100">{truncateHouseholdName(current.household_name)}</span>
          </span>
        </button>
      ) : (
        <div className="min-w-0 flex-1 px-2 py-1" aria-label={`Active household ${current.household_name}`}>
          <span className="block truncate text-xs uppercase tracking-[0.16em] text-base-content/45">Household</span>
          <span className="block truncate text-sm text-amber-100">{truncateHouseholdName(current.household_name)}</span>
        </div>
      )}
      <AccessibleDialog
        open={open}
        title="Switch household"
        description="Choose the household whose data should be shown."
        size="bottom"
        onClose={() => setOpen(false)}
      >
        <div className="space-y-2 household-bottom-safe">
          {memberships.map((membership) => (
            <HouseholdOption
              key={membership.household_id}
              membership={membership}
              active={membership.household_id === activeHouseholdId}
              disabled={switchingTo != null}
              onSelect={selectHousehold}
            />
          ))}
          <Link to="/household/new" className="btn btn-outline btn-bevel w-full no-underline" onClick={() => setOpen(false)}>
            + Create new household
          </Link>
          {error ? <p className="text-sm text-error" role="alert">{error}</p> : null}
        </div>
      </AccessibleDialog>
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </div>
  )
}
