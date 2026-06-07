export const catalogListQueryKey = () => ['catalog'] as const

export const catalogDetailQueryKey = (catalogId: string) => ['catalog', catalogId] as const

export const inventoryQueryKey = () => ['inventory'] as const

export const dashboardQueryKey = () => ['dashboard'] as const

export const brewLogListQueryKey = () => ['brew-log'] as const

export const defaultsBagQueryKey = (bagId: string) => ['defaults', bagId] as const

export const defaultsQueryKey = (bagId: string, basketId = '') => ['defaults', bagId, basketId] as const
