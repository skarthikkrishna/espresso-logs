// All *_id fields are internal keys used only for routing/API calls.
// They must NEVER be rendered as visible text in any component.

export interface CatalogItem {
  catalog_id: string; // route key only — NEVER displayed
  roaster: string;
  bean_name: string;
  roast_level: string;
  product_url?: string;
  image_path?: string;
}

export interface InventoryBag {
  bag_id: string; // route key only — NEVER displayed
  display_name: string; // "Roaster — Bean name"
  beans: string;
  roast_date?: string;
  roast_level?: string;
  catalog_id: string; // route key only — NEVER displayed
  status: 'Active' | 'Finished';
  storage_method?: string;
}

export interface HardwareItem {
  hardware_id: string; // route key only — NEVER displayed
  category: 'Machine' | 'Grinder' | 'Basket' | 'Storage';
  name: string;
  image_path?: string;
}

export interface MaintenanceEvent {
  maintenance_id: string; // NEVER displayed
  hardware_id: string; // NEVER displayed
  hardware_name: string;
  date: string;
  action_type: string;
  notes?: string;
}

export interface BrewLogEntry {
  shot_id: string; // route key only — NEVER displayed
  date: string;
  bag_display: string; // "Roaster — Bean name"
  roast_level?: string;
  machine_name?: string;
  grinder_name?: string;
  basket_name?: string;
  storage_method?: string;
  dose_in_g?: number;
  yield_out_g?: number;
  time_sec?: number;
  grind_setting?: string;
  shot_eligibility?: string;
  taste_summary?: string;
  user_notes?: string;
  ai_feedback?: string;
}

export interface DashboardBag {
  bag_id: string; // route key only — NEVER displayed
  display_name: string;
  roast_level?: string;
  days_since_last_shot?: number;
  last_shot?: {
    dose_in_g?: number;
    yield_out_g?: number;
    time_sec?: number;
    shot_eligibility?: string;
  };
}

export interface DefaultsPayload {
  machine_id?: string;
  grinder_id?: string;
  basket_id?: string;
  storage_method?: string;
  dose_in_g?: number | string;
  yield_out_g?: number | string; // NEW — from basket-history Level 0 lookup
  grind_setting?: string;
}

export interface Membership {
  household_id: string;
  household_name: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export type HouseholdMembership = Membership;

export interface CurrentUser {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  picture_url: string | null;
  created_at?: string | null;
  /** Legacy single-household fields — present when backend has not yet migrated to memberships[]. */
  household_id: string | null;
  role: 'admin' | 'member' | null;
  /** M5 multi-household model — returned by updated /auth/me. */
  memberships?: Membership[];
  active_household_id?: string | null;
}

export interface CatalogDetail {
  item: CatalogItem;
  bags: InventoryBag[];
  recent_shots: BrewLogEntry[];
}

export interface HardwareDetail {
  item: HardwareItem;
  maintenance: MaintenanceEvent[];
}
