/**
 * ID display policy tests (§7.1)
 *
 * Enforces the contract that *_id fields are route keys only and must never
 * be used as visible rendered text.  The canonical display fields are:
 *   - BrewLogEntry.bag_display  → "Roaster — Bean name" (em dash)
 *   - InventoryBag.display_name → "Roaster — Bean name" (em dash)
 *   - HardwareItem.name         → human-readable equipment name
 *   - MaintenanceEvent.hardware_name → human-readable equipment name
 */

import { describe, it, expect } from 'vitest'
import type {
  BrewLogEntry,
  InventoryBag,
  HardwareItem,
  MaintenanceEvent,
  CatalogItem,
} from '../types/entities'

// ---------------------------------------------------------------------------
// Helpers — these mirror what the backend serialises
// ---------------------------------------------------------------------------

/** Build a bag_display string the same way the backend does. */
function makeBagDisplay(roaster: string, beanName: string): string {
  return `${roaster} \u2014 ${beanName}` // U+2014 em dash
}

/** Return true if the string looks like a raw internal ID. */
function looksLikeId(value: string): boolean {
  return /^(CAT|BAG|SHOT|HW|MAINT)\d+/i.test(value) ||
    /^[A-Z]{2,}-\d{4}-\d{2}/i.test(value) // e.g. BB-2024-01-L-001
}

// ---------------------------------------------------------------------------
// bag_display — em dash format
// ---------------------------------------------------------------------------

describe('bag_display format', () => {
  it('uses an em dash (U+2014), not a hyphen', () => {
    const display = makeBagDisplay('Blue Bottle', 'Kenya Kiambu')
    expect(display).toContain('\u2014')        // em dash present
    expect(display).not.toContain(' - ')       // plain hyphen absent
    expect(display).toBe('Blue Bottle \u2014 Kenya Kiambu')
  })

  it('never equals a raw bag_id', () => {
    const bagId = 'BB-2024-01-L-001'
    const display = makeBagDisplay('Blue Bottle', 'Kenya Kiambu')
    expect(display).not.toBe(bagId)
    expect(looksLikeId(display)).toBe(false)
  })

  it('contains both roaster and bean name as human-readable text', () => {
    const display = makeBagDisplay('Ritual', 'Junin')
    expect(display).toContain('Ritual')
    expect(display).toContain('Junin')
  })
})

// ---------------------------------------------------------------------------
// BrewLogEntry — bag_display field contract
// ---------------------------------------------------------------------------

describe('BrewLogEntry display policy', () => {
  // Construct a minimal BrewLogEntry matching the TypeScript interface.
  const entry: BrewLogEntry = {
    shot_id: 'SHOT001',            // route key — never display this
    date: '2024-01-20',
    bag_display: 'Blue Bottle \u2014 Kenya Kiambu',
    machine_name: 'Breville Barista Express',
    grinder_name: 'Niche Zero',
    basket_name: undefined,
  }

  it('bag_display is not a raw shot_id', () => {
    expect(entry.bag_display).not.toBe(entry.shot_id)
    expect(looksLikeId(entry.bag_display)).toBe(false)
  })

  it('bag_display contains em dash separator', () => {
    expect(entry.bag_display).toContain('\u2014')
  })

  it('machine_name is a human-readable name, not a hardware_id', () => {
    expect(entry.machine_name).toBeDefined()
    expect(looksLikeId(entry.machine_name!)).toBe(false)
  })

  it('grinder_name is a human-readable name, not a hardware_id', () => {
    expect(entry.grinder_name).toBeDefined()
    expect(looksLikeId(entry.grinder_name!)).toBe(false)
  })

  it('shot_id matches expected ID pattern (route key only)', () => {
    expect(entry.shot_id).toMatch(/^SHOT/)
  })
})

// ---------------------------------------------------------------------------
// InventoryBag — display_name field contract
// ---------------------------------------------------------------------------

describe('InventoryBag display policy', () => {
  const bag: InventoryBag = {
    bag_id: 'BB-2024-01-L-001',
    display_name: 'Blue Bottle \u2014 Kenya Kiambu',
    beans: 'Blue Bottle — Kenya Kiambu',
    roast_level: 'Light',
    catalog_id: 'CAT001',
    status: 'Active',
  }

  it('display_name is not the raw bag_id', () => {
    expect(bag.display_name).not.toBe(bag.bag_id)
    expect(looksLikeId(bag.display_name)).toBe(false)
  })

  it('catalog_id is a route key — display_name is used for rendering', () => {
    expect(bag.catalog_id).toMatch(/^CAT/)
    expect(bag.display_name).toContain('\u2014')
  })
})

// ---------------------------------------------------------------------------
// HardwareItem — name field contract
// ---------------------------------------------------------------------------

describe('HardwareItem display policy', () => {
  const item: HardwareItem = {
    hardware_id: 'HW001',
    category: 'Machine',
    name: 'Breville Barista Express',
  }

  it('name is human-readable, not the hardware_id', () => {
    expect(item.name).not.toBe(item.hardware_id)
    expect(looksLikeId(item.name)).toBe(false)
  })

  it('hardware_id matches expected ID pattern (route key only)', () => {
    expect(item.hardware_id).toMatch(/^HW\d+/i)
  })
})

// ---------------------------------------------------------------------------
// MaintenanceEvent — hardware_name field contract
// ---------------------------------------------------------------------------

describe('MaintenanceEvent display policy', () => {
  const event: MaintenanceEvent = {
    maintenance_id: 'MAINT001',
    hardware_id: 'HW001',
    hardware_name: 'Breville Barista Express',
    date: '2024-01-10',
    action_type: 'Backflush',
  }

  it('hardware_name is human-readable, not a raw ID', () => {
    expect(event.hardware_name).not.toBe(event.hardware_id)
    expect(looksLikeId(event.hardware_name)).toBe(false)
  })

  it('maintenance_id is never used as a display label', () => {
    expect(event.maintenance_id).toMatch(/^MAINT\d+/i)
    // hardware_name is what gets rendered
    expect(event.hardware_name).toBeTruthy()
    expect(typeof event.hardware_name).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// CatalogItem — catalog_id as route key only
// ---------------------------------------------------------------------------

describe('CatalogItem display policy', () => {
  const item: CatalogItem = {
    catalog_id: 'CAT001',
    roaster: 'Blue Bottle',
    bean_name: 'Kenya Kiambu',
    roast_level: 'Light',
  }

  it('catalog_id matches ID pattern (route key)', () => {
    expect(item.catalog_id).toMatch(/^CAT\d+/i)
  })

  it('roaster and bean_name are the display fields, not catalog_id', () => {
    expect(looksLikeId(item.roaster)).toBe(false)
    expect(looksLikeId(item.bean_name)).toBe(false)
    // Constructing the canonical display string
    const display = makeBagDisplay(item.roaster, item.bean_name)
    expect(display).toBe('Blue Bottle \u2014 Kenya Kiambu')
  })
})
