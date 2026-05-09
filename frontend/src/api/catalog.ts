import { apiClient } from './client'
import type { CatalogItem, CatalogDetail, InventoryBag } from '../types/entities'

export const listCatalog = () =>
  apiClient.get<CatalogItem[]>('/api/catalog').then((r) => r.data)

export const getCatalogDetail = (id: string) =>
  apiClient.get<CatalogDetail>(`/api/catalog/${id}`).then((r) => r.data)

export const createCatalogItem = (data: Omit<CatalogItem, 'catalog_id'> & { source_image_url?: string | null }) =>
  apiClient.post<CatalogItem>('/api/catalog', data).then((r) => r.data)

export const updateCatalogItem = (
  catalogId: string,
  data: { roaster: string; bean_name: string; roast_level: string; product_url?: string | null },
) =>
  apiClient.put<CatalogItem>(`/api/catalog/${catalogId}`, data).then((r) => r.data)

export const createInventoryBag = (catalogId: string, data: Partial<InventoryBag>) =>
  apiClient.post<InventoryBag>(`/api/catalog/${catalogId}/inventory`, data).then((r) => r.data)

export type InferCatalogOut = {
  roaster: string;
  bean_name: string;
  roast_level: string;
  image_path: string | null;
};

export const inferCatalogItem = (url: string) =>
  apiClient.post<InferCatalogOut>('/api/catalog/infer', { url }).then((r) => r.data);

export const uploadCatalogImage = (catalogId: string, file: File) => {
  const form = new FormData()
  form.append('file', file)
  return apiClient
    .post<{ image_path: string }>(`/api/catalog/${catalogId}/image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data)
}
