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
    more: 'more',
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
  auth: {
    signIn: 'Sign in',
    signingIn: 'Signing in...',
    signingInAria: 'Signing in',
    oauthBody: 'Signing you in…',
    oauthInviteNote: 'Your household invitation will continue after Google sign-in.',
    loginInviteBanner: 'A household invitation is ready. Sign in to review and accept it.',
    usernameLabel: 'Username',
    passwordLabel: 'Password',
    usernameRequired: 'Username is required',
    passwordRequired: 'Password is required',
    invalidCredentials: 'Invalid username or password',
    rateLimited: 'Too many failed attempts. Try again in 15 minutes.',
    connectionError: 'Unable to connect. Please check your connection.',
    unexpectedError: 'An unexpected error occurred. Please try again.',
    googleFailed: 'Google sign-in failed. Please try again.',
    orDivider: 'or',
    googleSignIn: 'Sign in with Google',
    forgotPassword: 'Forgotten your password? Contact your household admin.',
    noAccountPrompt: "Don't have an account?",
    registerCta: 'Register',
    createAccount: 'Create account',
    creatingAccount: 'Creating account...',
    registerInviteBanner:
      "Create your account, then we'll return you to the household invitation.",
    displayNameLabel: 'Display name',
    displayNameHint: 'optional',
    confirmPasswordLabel: 'Confirm password',
    usernameTooShort: 'Username must be at least 3 characters',
    usernameTooLong: 'Username must be 30 characters or less',
    usernameInvalid: 'Username can only contain letters, numbers, and underscores',
    passwordTooShort: 'Password must be at least 12 characters',
    passwordsNoMatch: 'Passwords do not match',
    usernameTaken: 'Username already taken. Please choose another.',
    registrationFailed: 'Registration failed. Please check your inputs.',
    serverError:
      'Something went wrong on our end. Your account may have been created — try signing in.',
    haveAccountPrompt: 'Already have an account?',
  },
  invite: {
    eyebrow: 'Household invitation',
    joinHeading: (name: string) => `Join ${name}`,
    invitedBy: (inviter: string, role: string) =>
      `${inviter} invited you to join as a ${role}.`,
    expires: (when: string) => `Expires ${when}`,
    expirySoon: 'soon',
    dismissedBanner:
      'Invitation dismissed. The link was not consumed; you can revisit it before expiry if you change your mind.',
    loadError:
      'Could not load this invitation. Please retry or ask the household admin for a new link.',
    acceptFailed: 'Failed to accept the invitation. Please try again.',
    declineFailed:
      'Could not dismiss the invitation. You can still leave this page without accepting.',
    joining: 'Joining…',
    accept: 'Accept invitation',
    dismissing: 'Dismissing…',
    decline: 'Decline without accepting',
    goToDashboard: 'Go to dashboard',
    loadingAria: 'Loading invitation',
    loadingBody: 'Loading invitation…',
    invalidEyebrow: 'Invitation unavailable',
    invalidTitle: 'This invitation link is not valid',
    invalidBody:
      'Ask the household admin to send you a new invitation. For security, links stop working when they are revoked, replaced, or already resolved.',
    expiredEyebrow: 'Invitation expired',
    expiredTitle: 'This invitation has expired',
    expiredBody:
      'Ask the household admin to resend your invitation. New links are copyable from household settings and remain available until expiry or revocation.',
    signIn: 'Sign in',
    createAccount: 'Create account',
  },
  welcome: {
    eyebrow: 'Household setup',
    title: 'Welcome to Kaapi Kadai',
    intro:
      "Kaapi Kadai is a household app. You'll need to either create a new household or accept an invitation from a friend.",
    createCta: 'Create my household',
    inviteCta: 'I have an invitation',
    createTitle: 'Create your household',
    submit: 'Create household',
    creating: 'Creating household...',
    back: '← Back',
    inviteTitle: 'Join with an invitation',
    inviteBody:
      'Ask a household admin to share an invitation link with you. Open that link to join their household directly. No email address is required — the link is all you need.',
    inviteBack: '← Create a new household instead',
    loadingAria: 'Loading welcome',
    loadingBody: 'Preparing household setup…',
    notYou: 'Not you?',
    createInvalid: 'Could not create household. Please check your inputs.',
    duplicateName:
      'A household with that name already exists. Please choose a different name.',
    connectionError: 'Unable to connect. Please check your connection and try again.',
    createFailed: 'Could not create household. Please try again.',
  },
  notFound: {
    code: '404',
    title: 'Page not found',
    body: "The page you're looking for doesn't exist.",
    goHome: 'Go home',
  },
  modals: {
    addBean: {
      title: 'Add bean',
      urlLabel: 'Product URL',
      urlHint: 'optional',
      urlPlaceholder: 'https://...',
      lookUp: 'Look up',
      inferError: "Couldn't look up that URL. Enter details manually.",
      enterManually: 'Enter manually',
      roasterLabel: 'Roaster',
      roasterRequired: 'Roaster is required',
      beanNameLabel: 'Bean name',
      beanNameRequired: 'Bean name is required',
      roastLevelLabel: 'Roast level',
      roastLevelRequired: 'Roast level is required',
      selectRoast: 'Select...',
      imageLabel: 'Bean image',
      imageHint: 'optional',
      imageHelp: 'Choose a JPG, PNG, or other image file to upload after the bean is saved.',
      selectedImage: (name: string) => `Selected: ${name}`,
      creating: 'Creating bean…',
      uploading: 'Uploading image…',
      save: 'Save bean',
      saveFailed: 'Failed to save bean. Please try again.',
      validationFailed: 'Validation failed. Please check required fields.',
      requiredMissing: (names: string) => `Required fields missing: ${names}`,
      imageUploadFailed:
        'Bean saved, but image upload failed. Open the saved bean detail and choose Replace image to retry.',
      openSavedDetail: 'Open saved bean detail',
    },
    addHardware: {
      title: 'Add hardware',
      categoryLabel: 'Category',
      categoryPlaceholder: 'Select category…',
      nameLabel: 'Name',
      namePlaceholder: 'e.g. Breville Barista Express',
      urlLabel: 'Product URL',
      urlHint: 'optional — for auto-image',
      urlPlaceholder: 'https://…',
      save: 'Save hardware',
      saveError: "Couldn't save hardware. Please try again.",
    },
    editHardware: {
      title: 'Edit hardware',
      nameLabel: 'Name',
      save: 'Save changes',
      saveError: "Couldn't update hardware. Please try again.",
    },
    logMaintenance: {
      title: 'Log maintenance',
      hardwareLabel: 'Hardware',
      dateLabel: 'Date',
      futureDateError: 'Date cannot be in the future.',
      actionTypeLabel: 'Action type',
      loadingActionTypes: 'Loading action types…',
      actionTypesError: "Couldn't load action types. Close and try again.",
      actionPlaceholder: 'Select action…',
      notesLabel: 'Notes',
      notesHint: 'optional',
      saveError: "Couldn't log maintenance. Please try again.",
    },
  },
  shell: {
    primaryNav: 'Primary',
    brand: 'Kaapi Kadai',
  },
  appError: {
    boundary: 'Something went wrong. Please refresh the page.',
  },
  loadingState: {
    aria: 'Loading',
    householdContext: 'Loading household context…',
  },
  fields: {
    dose: 'Dose',
    yield: 'Yield',
    time: 'Time',
    grindSetting: 'Grind setting',
    taste: 'Taste',
    storage: 'Storage',
    machine: 'Machine',
    grinder: 'Grinder',
    basket: 'Basket',
  },
  compass: {
    axisRatio: 'Sour  ←  Ratio  →  Bitter',
    axisTime: 'Fast ↕ Slow',
    addDose: 'Add dose →',
    promptDoseYield: 'Enter dose and yield for extraction guidance.',
    promptTime: 'Add shot time to see the live extraction zone.',
    nullDose: 'Add dose before reading extraction guidance.',
    selectedTasteNote: (taste: string) => `Selected taste note: ${taste}.`,
    personalNote: (suggested: string, tasted: string) =>
      `Your parameters suggest ${suggested}, but you tasted ${tasted} — taste is personal!`,
    legend: '⬤ Your shot \u00A0·\u00A0 Zones = extraction outcome',
  },
  dashboard: {
    loadError: "Couldn't load dashboard",
    recent: 'Recent',
    summaryAria: 'Dashboard summary',
    viewAll: 'View all →',
    manageCatalog: 'Manage catalog',
    emptyTitle: 'No coffee data yet',
    emptyBody: 'Add your first bag or import a CSV to start this household with clean data.',
    addFirstBag: 'Add your first bag',
    importCsv: 'Import CSV',
    readyToBrew: 'Ready to brew',
    noActiveBagsTitle: 'No active bags yet',
    noActiveBagsBody: 'Add a bag from your catalog before logging household shots.',
    goToCatalog: 'Go to catalog',
    noShots: 'No shots logged yet.',
  },
  catalog: {
    listLoadError: "Couldn't load catalog",
    library: 'Coffee library',
    emptyTitle: 'No beans in catalog yet',
    emptyBody: 'Add the first coffee this household brews. Fresh households start empty.',
    addCoffee: 'Add coffee',
    searchPlaceholder: 'Search roaster or bean…',
    searchAria: 'Search catalog',
    noResults: 'No results found.',
    detailLoadError: "Couldn't load coffee details",
    replaceImage: 'Replace image',
    selectPlaceholder: 'Select…',
    viewOnRoaster: 'View on roaster website ↗',
    noRoasterLink: 'No roaster link saved.',
    bags: 'Bags',
    addBag: '+ Add bag',
    roastLockedPrefix: 'Roast level set by catalog:',
    noBags: 'No bags in inventory.',
    brewHistory: 'Brew history',
    noShots: 'No shots logged yet.',
    doseYield: 'Dose → yield',
    time: 'Time',
  },
  brewLogList: {
    loadError: 'Failed to load brew log.',
    loading: 'Loading brew log',
    retryBody: 'Check your connection and try again.',
    syncAlert: 'Your brew log history may be incomplete. Contact support or run the sync check.',
    syncAlertTitle: 'Sync check warning',
    shotSaved: 'Shot saved!',
    emptyTitle: 'No shots logged yet.',
    emptyBody:
      'Your recent brews will appear here once you start logging shots. Fresh households start empty.',
    grind: 'Grind',
    machine: 'Machine:',
    grinder: 'Grinder:',
    basket: 'Basket:',
    addShot: 'Add shot',
  },
  brewLogAdd: {
    title: 'Add shot',
    loadError: "Couldn't load your beans",
    loadErrorBody: 'Check your connection and try again.',
    selectBag: 'Select bag…',
    checkingBag: 'Checking selected bag from Home…',
    loadingBaskets: 'Loading baskets…',
    noBaskets: 'No baskets found',
    selectBasket: 'Select basket…',
    selectPlaceholder: 'Select…',
    extractionCompass: 'Extraction compass',
    selectMachine: 'Select machine…',
    selectGrinder: 'Select grinder…',
    selectStorage: 'Select storage…',
    saveError: 'Failed to save shot. Please try again.',
    submit: 'Log shot',
  },
  brewLogDetail: {
    loadError: 'Failed to load shot.',
    correctTitle: 'Correct shot details',
    correctFormTitle: 'Correct typo-safe fields',
    correctFormHint:
      'Only notes, taste, grind setting, and shot eligibility can be corrected here.',
    noEligibility: 'No eligibility',
    saveCorrections: 'Save corrections',
    shotParameters: 'Shot parameters',
    extractionShape: 'Extraction shape',
    extractionReadout: {
      ratioLabel: 'Brew ratio',
      zoneLabel: 'Extraction zone',
      timeNeeded: 'Time needed for zone',
      unavailable: 'Zone unavailable',
    },
    aiFeedback: 'AI feedback',
    noFeedback: 'No feedback available yet.',
  },
  hardware: {
    photo: 'Photo',
    imageUpdated: 'Image updated.',
    imageUploadFailed: 'Image upload failed. Please try again.',
    uploadingImage: 'Uploading image…',
    loadError: "Couldn't load hardware",
    emptyTitle: 'No hardware yet',
    emptyBody: 'Add the machine, grinder, basket, and storage this household uses. Fresh households start empty.',
    backToHardware: '← Back',
    details: 'Details',
    viewProduct: 'View product →',
    maintenanceLog: 'Maintenance log',
    noMaintenance: 'No maintenance records.',
    unavailable: 'This hardware item is no longer available.',
    add: 'Add',
    selectHint: 'Select for details and maintenance.',
  },
  import: {
    progressAria: 'Import progress',
    title: 'Bring in your coffee data',
    importingInto: 'Importing into:',
    uploadFile: 'Upload file',
    uploadIntro:
      'Choose a CSV exported from your spreadsheet. Kaapi Kadai previews the file first, so you can fix rows before saving anything.',
    downloadExample: 'Download example CSV',
    exampleNote: 'Use this as a starting point; it contains fake sample data only.',
    uploadHint: 'Upload a .csv exported from your spreadsheet. You can preview before anything is saved.',
    chooseCsv: 'Choose CSV',
    unlockPreviewTitle: 'Upload a CSV to unlock preview',
    unlockPreviewBody:
      'The Preview step becomes available after we detect a header row and at least one data row.',
    ready: 'Ready',
    readyToReview: (count: number) =>
      `${count} row${count !== 1 ? 's' : ''} ready to review before import.`,
    previewRows: 'Preview rows',
    validityCount: (valid: number, invalid: number) => `${valid} valid · ${invalid} with issues`,
    colType: 'Type',
    colSummary: 'Summary',
    colStatus: 'Status',
    rowLabel: 'Row',
    needsFix: 'Needs fix',
    skipNote: 'Rows with issues are skipped so you can fix them in your CSV and try again.',
    complete: 'Import complete',
    completeSummary: (success: number, errors: number) =>
      `${success} row${success !== 1 ? 's' : ''} imported successfully${errors > 0 ? `, ${errors} failed` : ''}.`,
    importMore: 'Import more',
    columnsTitle: 'What each column means',
    fieldWhere: (why: string, where: string) => `${why}. Find it in ${where}.`,
    example: 'Example:',
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
