/**
 * Tone System — shared, reusable component library.
 *
 * All components here satisfy the 12 principles in aria-principles-northstar.md.
 * Phase 1 implementation — espresso-logs foundation rebuild.
 *
 * Usage:
 *   import { ToneProvider, useTone, TakeoverCard, Section, ... } from '@/components/tone-system'
 */

// Context + hook (also importable from contexts/ToneContext directly)
export { ToneProvider, useTone } from '../../contexts/ToneContext'

// Page shell
export { TonePageWrapper } from './TonePageWrapper'
export { TakeoverCard } from './TakeoverCard'
export { BackLink } from './BackLink'
export { ToneToggle } from './ToneToggle'

// Layout primitives
export { Section } from './Section'
export { SectionHeader } from './SectionHeader'
export { TitleBlock } from './TitleBlock'
export { TitleIcon } from './TitleIcon'

// Data display
export { Chip } from './Chip'
export { RoastChip } from './RoastChip'
export { ParamGrid, ParamPair } from './ParamGrid'
export { MarkdownProse } from './MarkdownProse'

// Action
export { ToneButton } from './ToneButton'

// Form atoms
export { FormSection } from './FormSection'
export { ToneInput } from './ToneInput'
export { ToneSelect } from './ToneSelect'
export { ToneTextarea } from './ToneTextarea'

// Immersive list shell + entity cards
export { ImmersiveListShell } from './ImmersiveListShell'
export { EntityCard } from './EntityCard'
export type { EntityCardProps } from './EntityCard'
export { ListPageHeader } from './ListPageHeader'
export { ImmersiveEmptyState } from './ImmersiveEmptyState'
export { ImmersiveFab } from './ImmersiveFab'

// Summary page atoms
export { StatTile, StatTileSkeleton } from './StatTile'
export type { StatTileProps } from './StatTile'
export { ShotRow, ShotRowSkeleton } from './ShotRow'
export type { ShotRowProps } from './ShotRow'
