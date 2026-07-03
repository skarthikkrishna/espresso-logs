export {
  APPROVED_COPY,
  COPY,
  DASHBOARD_SUBTITLE,
  FORBIDDEN_DASHBOARD_COPY,
  LOCKED_LABELS,
  isApprovedCopy,
  type LockedLabelKey,
} from './registry'

// `./audit` is intentionally NOT re-exported here: it imports the TypeScript
// compiler, so re-exporting it would pull ~3.4 MB into every production bundle
// that imports COPY. Audit consumers (tests only) import from './audit' directly.
