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
export { FormPageShell } from './FormPageShell'
export type { FormPageShellProps } from './FormPageShell'
export { WizardShell } from './WizardShell'
export type { WizardShellProps } from './WizardShell'
export { TakeoverCard } from './TakeoverCard'
export { BackLink } from './BackLink'
export { ToneToggle } from './ToneToggle'

// Layout primitives
export { Section } from './Section'
export { SectionHeader } from './SectionHeader'
export { DetailHeader } from './DetailHeader'
export { TitleBlock } from './TitleBlock'
export { TitleIcon } from './TitleIcon'

// Data display
export { BagCard } from './BagCard'
export type { BagCardVariant } from './BagCard'
export { ShotCard } from './ShotCard'
export type { ShotCardVariant } from './ShotCard'
export { HardwareCard } from './HardwareCard'
export { Chip, ExtractionChip, MetricChip } from './Chip'
export { RoastChip } from './RoastChip'
export { ParamGrid, ParamPair } from './ParamGrid'
export { MarkdownProse } from './MarkdownProse'

// Action
export { ToneButton } from './ToneButton'
export { ToneLinkAction } from './ToneLinkAction'
export { EntityFormActions } from './EntityFormActions'
export type { EntityFormActionsProps } from './EntityFormActions'
export { LogShotAction } from './actions/LogShotAction'
export type { LogShotActionVariant } from './actions/LogShotAction'
export { AddBagAction } from './actions/AddBagAction'
export type { AddBagActionVariant } from './actions/AddBagAction'
export { AddBeanAction } from './actions/AddBeanAction'
export type { AddBeanActionVariant } from './actions/AddBeanAction'

// Wizard components
export { ToneStepper } from './ToneStepper'
export type { ToneStepperProps } from './ToneStepper'
export { ImportPreviewRows } from './ImportPreviewRows'
export type { ImportPreviewRowsProps, ParsedRow } from './ImportPreviewRows'

// Form atoms
export { EntityFormSection } from './EntityFormSection'
export { FormSection } from './FormSection'
export { ToneInput } from './ToneInput'
export { ToneSelect } from './ToneSelect'
export { ToneTextarea } from './ToneTextarea'

// Immersive list shell + entity cards
export { ImmersiveListShell } from './ImmersiveListShell'
export { CompactChipRow, EntityButtonCard, EntityCard } from './EntityCard'
export type { CompactCardChip, EntityCardProps } from './EntityCard'
export { getFittingCompactChipCount } from './compactChipOverflow'
export { ListPageHeader } from './ListPageHeader'
export { ImmersiveEmptyState } from './ImmersiveEmptyState'
export { ImmersiveFab } from './ImmersiveFab'
export { ToneStateCard } from './ToneStateCard'
export type { ToneStateCardState } from './ToneStateCard'

// Summary page atoms
export { StatTile, StatTileSkeleton } from './StatTile'
export type { StatTileProps } from './StatTile'
export { ShotRow, ShotRowSkeleton } from './ShotRow'
export type { ShotRowProps } from './ShotRow'
