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
  common: {
    unavailable: 'Unavailable',
    cancel: 'Cancel',
    retry: 'Retry',
  },
  profile: {
    eyebrow: 'Account',
    title: 'Profile',
    authGoogle: 'Google',
    authPassword: 'Username + password',
    passwordResetTitle: 'Password reset',
    passwordResetBody:
      'Password resets are admin-assisted for household safety. Ask a household admin to reset your password if you lose access.',
    householdsTitle: 'My households',
    householdsHint: 'Open a household, manage admin settings, or create another workspace.',
    noHouseholds:
      'You are not a member of a household yet. Create one or ask an admin for an invitation link.',
    active: 'Active',
    current: 'Current',
    open: 'Open',
    manage: 'Manage',
    switchError: 'Could not switch households. Please try again.',
    opening: (name: string) => `Opening ${name}…`,
    nowActive: (name: string) => `${name} is now active.`,
    joined: (date: string) => `Joined ${date}`,
    rowMeta: (count: number | null | undefined, date: string) =>
      `${count != null ? `${count} member${count === 1 ? '' : 's'} • ` : ''}Joined ${date}`,
  },
  householdSettings: {
    eyebrow: 'Admin',
    title: 'Household settings',
    memberCount: (current: number, max: number) => `${current} / ${max} members`,
    nameLabel: 'Household name',
    saveName: 'Save name',
    saving: 'Saving…',
    created: (date: string) => `Created ${date}`,
    membersTitle: 'Members',
    you: 'You',
    promote: 'Promote to admin',
    demote: 'Demote to member',
    remove: 'Remove',
    lastAdmin: 'Every household needs at least one admin.',
    memberMeta: (email: string | null, username: string | null, date: string) =>
      `${email ? `${email} • ` : ''}${username ? `@${username} • ` : ''}Joined ${date}`,
    inviteTitle: 'Invite management',
    inviteHint:
      'Email is optional — it labels who this invite is for. No email is sent. Copy and share the link yourself.',
    inviteEmailLabel: 'Invite email',
    inviteEmailPlaceholder: 'Email (optional)',
    inviteRoleLabel: 'Invite role',
    roleMember: 'Member',
    roleAdmin: 'Admin',
    createInvite: 'Create invite link',
    creating: 'Creating…',
    memberLimit: 'Member limit reached (10/10)',
    latestInviteLabel: 'Latest invitation link',
    copyLatest: 'Copy latest link',
    pendingTitle: 'Pending invitations',
    pendingNone: 'No pending invitations.',
    expires: (date: string) => `Expires ${date}`,
    copy: 'Copy',
    resend: 'Resend',
    revoke: 'Revoke',
    guestTitle: 'Guest access',
    guestHint:
      'Create a read-only guest link for people who should view but never edit household coffee data.',
    openPreview: 'Open preview',
    generateGuest: 'Generate guest link',
    generating: 'Generating…',
    dangerTitle: 'Danger zone',
    dangerHint: 'Deleting a household is irreversible and removes its household-scoped data.',
    deleteHousehold: 'Delete household',
    removeMemberTitle: 'Remove member',
    removeMemberConfirm: (name: string) => `Remove ${name} from this household?`,
    removeMemberAction: 'Remove member',
    deleteConfirmPrompt: (name: string) => `Type ${name} exactly to confirm permanent deletion.`,
    deletePermanently: 'Delete permanently',
    noActiveTitle: 'No active household',
    noActiveBody: 'Create a household or accept an invitation before opening settings.',
    adminOnly: 'Only admins can access household settings.',
    loading: 'Loading settings',
    loadError: "Couldn't load household settings",
    status: {
      nameSaved: 'Household name saved.',
      roleUpdated: 'Member role updated.',
      memberRemoved: 'Member removed.',
      inviteCreated: 'Invite link created. No email is sent — copy and share the link yourself.',
      inviteRevoked: 'Invitation revoked.',
      inviteResent: 'Invitation resent with a fresh link.',
      guestGenerated: 'Guest link generated. Copy it before sharing.',
      guestRevoked: 'Guest link revoked.',
      householdDeleted: 'Household deleted.',
      copied: (label: string) => `${label} copied.`,
      copyLabelInvite: 'Invitation link',
      copyLabelGuest: 'Guest link',
    },
    errors: {
      saveName: 'Could not save household name.',
      role: 'Could not update member role.',
      removeMember: 'Could not remove member.',
      createInvite: 'Failed to create invitation.',
      revokeInvite: 'Could not revoke invitation.',
      resendInvite: 'Could not resend invitation.',
      generateGuest: 'Could not generate guest link.',
      revokeGuest: 'Could not revoke guest link.',
      deleteHousehold: 'Could not delete household.',
      noLink: 'No link is available to copy.',
      copyFailed: 'Copy failed. Select and copy the link manually.',
      duplicateInvite: 'An invitation to this address is already pending.',
      alreadyMember: 'This person is already a member.',
      removeSelf: 'You cannot remove yourself from the household.',
      adminAccess: 'Only admins can access household settings.',
      validation: 'Validation failed. Please check the highlighted fields.',
      offline: 'Unable to connect. Please check your connection.',
      retry: 'Please retry.',
    },
  },
  guest: {
    accessEyebrow: 'Guest access',
    linkUnavailableTitle: 'Guest link unavailable',
    linkInvalid: 'This guest link is no longer valid. Ask the household admin to share a new one.',
    signIn: 'Sign in',
    createAccount: 'Create an account',
    preparing: 'Preparing guest view',
    preparingBody: 'Preparing guest view…',
    loadErrorAuth:
      'We could not load this guest view. Ask the household admin to share a fresh link.',
    loadErrorNetwork:
      'We could not load this guest view. Check your connection and try again.',
    readonlyEyebrow: 'Read-only household view',
    readonlyBody:
      'Browse shared coffee activity without account access. Write actions, settings, imports, edits, and hardware management are hidden for guests.',
    activeBags: 'Active bags',
    activeBagsEmpty: 'No active bags are shared yet.',
    recentShots: 'Recent shots',
    recentShotsEmpty: 'No shots are shared yet.',
    catalog: 'Catalog',
    catalogEmpty: 'No beans are shared yet.',
    banner: (name: string) =>
      `You're viewing ${name} as a guest. Sign in or create an account to log shots.`,
  },
  onboarding: {
    nameLabel: 'Household name',
    namePlaceholder: 'e.g. Home, The Office, Studio…',
    nameHint: 'Give your household a name to get started.',
    nameRequired: 'Household name is required',
    nameTooLong: 'Name must be 64 characters or less',
  },
  householdNew: {
    eyebrow: 'New workspace',
    title: 'Create a household',
    submit: 'Create household',
    creating: 'Creating…',
    cancel: 'Cancel',
    duplicateName: 'A household with this name already exists.',
    offline: 'Unable to connect. Please check your connection.',
    createFailed: 'Failed to create household. Please try again.',
    unexpected: 'An unexpected error occurred.',
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
