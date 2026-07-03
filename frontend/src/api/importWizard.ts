import { apiClient } from './client'

export interface ImportWizardSession {
  session_id: string
}

export const startImportWizard = () =>
  apiClient.get<ImportWizardSession>('/api/import').then((r) => r.data)
