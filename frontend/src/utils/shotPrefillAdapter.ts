import type { BrewLogEntry } from '../types/entities'

export interface ShotPrefillValues {
  bagId: string
  machineId: string
  grinderId: string
  basketId: string
  doseG: string
  yieldG: string
  timeSec: string
  grindSetting: string
  storageMethod: string
  eligibility: string
  tasteSummary: string
  notes: string
}

const emptyPrefill: ShotPrefillValues = {
  bagId: '',
  machineId: '',
  grinderId: '',
  basketId: '',
  doseG: '',
  yieldG: '',
  timeSec: '',
  grindSetting: '',
  storageMethod: '',
  eligibility: '',
  tasteSummary: '',
  notes: '',
}

function numberField(value: number | undefined): string {
  return value == null ? '' : String(value)
}

function textField(value: string | null | undefined): string {
  return value ?? ''
}

export const ShotPrefillAdapter = {
  toAddShotPath(shotId: string): string {
    return `/brew-log/add?similar_shot_id=${encodeURIComponent(shotId)}`
  },

  fromBrewLogEntry(shot: BrewLogEntry): ShotPrefillValues {
    return {
      ...emptyPrefill,
      bagId: textField(shot.bag_id),
      machineId: textField(shot.machine_id),
      grinderId: textField(shot.grinder_id),
      basketId: textField(shot.basket_id),
      doseG: numberField(shot.dose_in_g),
      yieldG: numberField(shot.yield_out_g),
      timeSec: numberField(shot.time_sec),
      grindSetting: textField(shot.grind_setting),
      storageMethod: textField(shot.storage_method),
      eligibility: textField(shot.shot_eligibility),
      tasteSummary: textField(shot.taste_summary),
      notes: textField(shot.user_notes),
    }
  },
} as const
