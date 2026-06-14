/**
 * Operator-owned copy registry (spec-043 T002).
 *
 * User-facing copy is operator-owned. Visible JSX text, accessibility props
 * (`aria-label`, `alt`, `placeholder`, `title`), toast/modal/helper text, and CTA
 * labels must resolve to an entry in this registry so that wording stays under a
 * single, reviewable source of truth.
 *
 * `LOCKED_LABELS` are frozen strings whose exact wording is fixed by the operator
 * and must not be paraphrased anywhere in the product: `Home`, `Log a shot`,
 * `Delete`.
 *
 * The dashboard subtitle is intentionally absent (Option D) — there is no
 * approved subtitle string, and the forbidden narration strings below must never
 * appear in production source.
 *
 * Scope note: this seed covers the shared shell, navigation, and primitive copy
 * touched by the spec-043 foundations wave. Page-family migrations (Wave 2) extend
 * `APPROVED_COPY` with their own approved strings; the app-wide audit is run by
 * Quinn in T024 once every page consumes the registry.
 */

/** Frozen labels whose exact wording is locked by the operator. */
export const LOCKED_LABELS = {
  home: 'Home',
  logAShot: 'Log a shot',
  delete: 'Delete',
} as const

export type LockedLabelKey = keyof typeof LOCKED_LABELS

/**
 * Option D — the dashboard has no subtitle. Exposed as an explicit `null` so the
 * absence is intentional and assertable rather than an oversight.
 */
export const DASHBOARD_SUBTITLE: null = null

/**
 * Narration strings that must never appear in production dashboard source. The
 * dashboard migration (T009) removes them; the copy audit (T024) keeps them out.
 * Listed here so the audit and tests share one definition.
 */
export const FORBIDDEN_DASHBOARD_COPY: readonly string[] = [
  'Brew with intention.',
  'Track active bags, recent shots, and household context from one warm espresso-dark cockpit.',
  'Ready for the next shot?',
  'This in-flow action stays clear of the mobile nav stack.',
] as const

/**
 * Approved user-facing copy, grouped by surface for readability. Every value is
 * flattened into {@link APPROVED_COPY}. Add new approved wording here — never
 * inline a raw literal at the render site.
 */
export const COPY = {
  nav: {
    home: LOCKED_LABELS.home,
    brewLog: 'Brew log',
    catalog: 'Catalog',
    hardware: 'Hardware',
    import: 'Import',
    profile: 'Profile',
  },
  actions: {
    logAShot: LOCKED_LABELS.logAShot,
    delete: LOCKED_LABELS.delete,
    cancel: 'Cancel',
    save: 'Save',
    retry: 'Retry',
    back: 'Back',
    close: 'Close',
    confirm: 'Confirm',
    edit: 'Edit',
    signOut: 'Sign out',
    openProfile: 'Open profile',
    manageHousehold: 'Manage household',
    createHousehold: 'Create household',
  },
  household: {
    label: 'Household',
    switch: 'Switch household',
    createNew: 'Create new household',
    accountMenu: 'Account menu',
    activeIndicator: 'Active household',
    membersUnavailable: 'Members unavailable',
  },
  pagination: {
    previous: 'Previous',
    next: 'Next',
    label: 'Pagination',
  },
  expander: {
    showMore: 'Show more',
    showFewer: 'Show fewer',
  },
  brewLog: {
    deleteTitle: 'Delete this shot?',
    deleteBody: 'This permanently removes the shot from your brew log. This cannot be undone.',
    deleteError: 'We could not delete this shot. Please try again.',
    deleting: 'Deleting…',
    moreOptions: 'More options',
    fewerOptions: 'Fewer options',
  },
} as const

const collectStrings = (value: unknown, sink: Set<string>): void => {
  if (typeof value === 'string') {
    sink.add(value)
    return
  }
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectStrings(nested, sink)
    }
  }
}

const buildApprovedCopy = (): ReadonlySet<string> => {
  const sink = new Set<string>()
  collectStrings(LOCKED_LABELS, sink)
  collectStrings(COPY, sink)
  return sink
}

/** Flattened set of every approved user-facing string. */
export const APPROVED_COPY: ReadonlySet<string> = buildApprovedCopy()

/** True when `text` (trimmed) is an approved user-facing string. */
export const isApprovedCopy = (text: string): boolean => APPROVED_COPY.has(text.trim())
