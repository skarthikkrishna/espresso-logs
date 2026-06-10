import type { QueryKey } from '@tanstack/react-query'

const householdScope = (householdId: string | null | undefined) => householdId ?? 'no-household'

export const authKeys = {
  me: ['auth', 'me'] as const,
}

export const householdKeys = {
  all: ['households'] as const,
  list: ['households', 'me'] as const,
  detail: (householdId: string | null | undefined) => ['households', householdScope(householdId), 'detail'] as const,
  settings: (householdId: string | null | undefined) => ['households', householdScope(householdId), 'settings'] as const,
  dashboard: (householdId: string | null | undefined) => ['households', householdScope(householdId), 'dashboard'] as const,
  brewLog: (householdId: string | null | undefined, page = 1, perPage = 100) =>
    ['households', householdScope(householdId), 'brew-log', { page, perPage }] as const,
  brewLogDetail: (householdId: string | null | undefined, shotId: string) =>
    ['households', householdScope(householdId), 'brew-log-detail', shotId] as const,
  brewLogFeedback: (householdId: string | null | undefined, shotId: string) =>
    ['households', householdScope(householdId), 'brew-log-detail', shotId, 'feedback'] as const,
  catalog: (householdId: string | null | undefined) => ['households', householdScope(householdId), 'catalog'] as const,
  catalogDetail: (householdId: string | null | undefined, catalogId: string) =>
    ['households', householdScope(householdId), 'catalog', catalogId] as const,
  inventory: (householdId: string | null | undefined) => ['households', householdScope(householdId), 'inventory'] as const,
  hardware: (householdId: string | null | undefined) => ['households', householdScope(householdId), 'hardware'] as const,
  hardwareDetail: (householdId: string | null | undefined, hardwareId: string | null | undefined) =>
    ['households', householdScope(householdId), 'hardware', hardwareId ?? 'none'] as const,
  actionTypes: (householdId: string | null | undefined) => ['households', householdScope(householdId), 'hardware', 'action-types'] as const,
  defaultsBag: (householdId: string | null | undefined, bagId: string) =>
    ['households', householdScope(householdId), 'defaults', bagId] as const,
  defaults: (householdId: string | null | undefined, bagId: string, basketId = '') =>
    ['households', householdScope(householdId), 'defaults', bagId, basketId] as const,
}

export const isHouseholdScopedQueryKey = (
  queryKey: QueryKey,
  householdId?: string | null,
): boolean => {
  if (queryKey[0] !== 'households') return false
  if (!householdId) return true
  return queryKey[1] === householdId || queryKey[1] === 'me'
}

export const catalogListQueryKey = (householdId?: string | null) => householdKeys.catalog(householdId)

export const catalogDetailQueryKey = (catalogId: string, householdId?: string | null) =>
  householdKeys.catalogDetail(householdId, catalogId)

export const inventoryQueryKey = (householdId?: string | null) => householdKeys.inventory(householdId)

export const dashboardQueryKey = (householdId?: string | null) => householdKeys.dashboard(householdId)

export const brewLogListQueryKey = (householdId?: string | null, page = 1, perPage = 100) =>
  householdKeys.brewLog(householdId, page, perPage)

export const defaultsBagQueryKey = (bagId: string, householdId?: string | null) =>
  householdKeys.defaultsBag(householdId, bagId)

export const defaultsQueryKey = (bagId: string, basketId = '', householdId?: string | null) =>
  householdKeys.defaults(householdId, bagId, basketId)
