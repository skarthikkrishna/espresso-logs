import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  brewLogDetailQueryKey,
  brewLogFeedbackQueryKey,
  deleteBrewLogEntry,
  generateBrewLogFeedback,
  getBrewLogDetail,
  getBrewLogFeedback,
  updateBrewLogEntry,
} from '../api/brewLog'
import type { BrewLogCorrectionPayload } from '../api/brewLog'
import { brewLogListQueryKey, dashboardQueryKey } from '../api/queryKeys'
import type { BrewLogPage } from '../api/brewLog'
import LoadingSpinner from '../components/LoadingSpinner'
import AccessibleDialog from '../components/AccessibleDialog'
import ExtractionReadout from '../components/ExtractionReadout'
import { Button } from '../components/ui'
import type { BrewLogEntry } from '../types/entities'
import { useHouseholdQueryScope } from '../contexts/AuthContext'
import { ToneProvider } from '../contexts/ToneContext'
import { useKaapiMotion } from '../lib/motion'
import { COPY, LOCKED_LABELS } from '../copy/registry'
import {
  BackLink,
  FormSection,
  MarkdownProse,
  ParamGrid,
  ParamPair,
  Section,
  SectionHeader,
  ShotCard,
  TakeoverCard,
  ToneButton,
  ToneInput,
  TonePageWrapper,
  ToneSelect,
  ToneTextarea,
  ToneToggle,
} from '../components/tone-system'

type CachedBrewLogShot = {
  shot: BrewLogEntry
  dataUpdatedAt: number | undefined
}

type CorrectionForm = {
  taste_summary: string
  user_notes: string
  grind_setting: string
  shot_eligibility: string
}

const ELIGIBILITY_OPTIONS = ['Reject', 'Passable', 'Good Espresso', 'God Shot'] as const

function isBrewLogEntry(value: unknown): value is BrewLogEntry {
  if (!value || typeof value !== 'object') return false
  return typeof (value as { shot_id?: unknown }).shot_id === 'string'
}

function isBrewLogPage(value: unknown): value is BrewLogPage {
  if (!value || typeof value !== 'object') return false
  const items = (value as { items?: unknown }).items
  return Array.isArray(items) && items.every(isBrewLogEntry)
}

function findCachedBrewLogShot(queryClient: QueryClient, shotId: string, householdId?: string | null): CachedBrewLogShot | undefined {
  if (!shotId) return undefined

  for (const [queryKey, page] of queryClient.getQueriesData<unknown>({ queryKey: ['households', householdId ?? 'no-household', 'brew-log'] })) {
    if (!isBrewLogPage(page)) continue

    const shot = page.items.find((entry) => entry.shot_id === shotId)
    if (shot) {
      return {
        shot,
        dataUpdatedAt: queryClient.getQueryState(queryKey)?.dataUpdatedAt,
      }
    }
  }

  return undefined
}

function apiErrorMessage(err: unknown, fallback: string): string {
  if (!axios.isAxiosError(err)) return fallback
  const detail = err.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) return 'Validation failed. Please check the highlighted fields.'
  return fallback
}

export default function BrewLogDetail() {
  return (
    <ToneProvider>
      <BrewLogDetailPage />
    </ToneProvider>
  )
}

function BrewLogDetailPage() {
  const { id } = useParams<{ id: string }>()
  const shotId = id ?? ''
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const rawBack = searchParams.get('back')
  // Security guard: accept only root-relative paths; reject protocol-relative (//evil.com)
  const backTarget = rawBack?.startsWith('/') && !rawBack?.startsWith('//') ? rawBack : '/brew-log'
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [correctionForm, setCorrectionForm] = useState<CorrectionForm>({
    taste_summary: '',
    user_notes: '',
    grind_setting: '',
    shot_eligibility: '',
  })
  const [correctionFieldError, setCorrectionFieldError] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const feedbackInFlightRef = useRef(false)
  const queryClient = useQueryClient()
  const activeHouseholdId = useHouseholdQueryScope()
  const cachedShot = findCachedBrewLogShot(queryClient, shotId, activeHouseholdId)
  const routeRef = useRef<HTMLDivElement>(null)
  const { routeEnter } = useKaapiMotion({ scope: routeRef })

  const { data: shot, isLoading, error } = useQuery({
    queryKey: brewLogDetailQueryKey(shotId, activeHouseholdId),
    queryFn: () => getBrewLogDetail(shotId),
    enabled: !!id,
    initialData: () => cachedShot?.shot,
    initialDataUpdatedAt: () => cachedShot?.dataUpdatedAt,
  })

  const { data: feedbackData } = useQuery({
    queryKey: brewLogFeedbackQueryKey(shotId, activeHouseholdId),
    queryFn: () => getBrewLogFeedback(shotId),
    enabled: !!id,
  })

  const correctionMutation = useMutation({
    mutationFn: (payload: BrewLogCorrectionPayload) => updateBrewLogEntry(shotId, payload),
    onSuccess: (updatedShot) => {
      const previous = queryClient.getQueryData<BrewLogEntry>(brewLogDetailQueryKey(shotId, activeHouseholdId))
      const mergedShot = {
        ...updatedShot,
        ai_feedback: updatedShot.ai_feedback ?? previous?.ai_feedback ?? shot?.ai_feedback,
      }
      queryClient.setQueryData<BrewLogEntry>(brewLogDetailQueryKey(shotId, activeHouseholdId), mergedShot)
      queryClient.invalidateQueries({ queryKey: brewLogListQueryKey(activeHouseholdId) })
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey(activeHouseholdId) })
      queryClient.invalidateQueries({ queryKey: brewLogDetailQueryKey(shotId, activeHouseholdId), refetchType: 'inactive' })
      setCorrectionOpen(false)
      setCorrectionFieldError(null)
    },
    onError: (err) => {
      setCorrectionFieldError(apiErrorMessage(err, 'Failed to save corrections. Please try again.'))
    },
  })

  const feedbackMutation = useMutation({
    mutationFn: () => generateBrewLogFeedback(shotId),
    onMutate: () => {
      setFeedbackMessage(null)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(brewLogFeedbackQueryKey(shotId, activeHouseholdId), data)
      queryClient.setQueryData<BrewLogEntry>(
        brewLogDetailQueryKey(shotId, activeHouseholdId),
        (old) => old ? { ...old, ai_feedback: data.ai_feedback ?? old.ai_feedback } : old,
      )
      queryClient.invalidateQueries({ queryKey: brewLogDetailQueryKey(shotId, activeHouseholdId), refetchType: 'inactive' })
      queryClient.invalidateQueries({ queryKey: brewLogListQueryKey(activeHouseholdId) })
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey(activeHouseholdId) })
      setFeedbackMessage('AI feedback updated.')
    },
    onSettled: () => {
      feedbackInFlightRef.current = false
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteBrewLogEntry(shotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brewLogListQueryKey(activeHouseholdId) })
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey(activeHouseholdId) })
      queryClient.removeQueries({ queryKey: brewLogDetailQueryKey(shotId, activeHouseholdId) })
      setDeleteOpen(false)
      setDeleteError(null)
      navigate(backTarget)
    },
    onError: (err) => {
      setDeleteError(apiErrorMessage(err, COPY.brewLog.deleteError))
    },
  })

  const confirmDelete = () => {
    if (deleteMutation.isPending) return
    setDeleteError(null)
    deleteMutation.mutate()
  }

  useEffect(() => {
    if (!isLoading && !error && routeRef.current) routeEnter(routeRef.current)
  }, [isLoading, error, routeEnter])

  if (isLoading) return <LoadingSpinner />
  if (error) return <div className="p-6 text-error">{COPY.brewLogDetail.loadError}</div>
  if (!shot) return null

  const openCorrectionForm = () => {
    setCorrectionForm({
      taste_summary: shot.taste_summary ?? '',
      user_notes: shot.user_notes ?? '',
      grind_setting: shot.grind_setting ?? '',
      shot_eligibility: shot.shot_eligibility ?? '',
    })
    setCorrectionFieldError(null)
    setCorrectionOpen(true)
  }

  const correctionPayload: BrewLogCorrectionPayload = {}
  if (correctionForm.taste_summary !== (shot.taste_summary ?? '')) correctionPayload.taste_summary = correctionForm.taste_summary
  if (correctionForm.user_notes !== (shot.user_notes ?? '')) correctionPayload.user_notes = correctionForm.user_notes
  if (correctionForm.grind_setting !== (shot.grind_setting ?? '')) correctionPayload.grind_setting = correctionForm.grind_setting
  if (correctionForm.shot_eligibility !== (shot.shot_eligibility ?? '')) {
    correctionPayload.shot_eligibility = correctionForm.shot_eligibility
  }
  const hasCorrectionChanges = Object.keys(correctionPayload).length > 0
  const correctionEligibilityValid = !correctionForm.shot_eligibility
    || ELIGIBILITY_OPTIONS.includes(correctionForm.shot_eligibility as (typeof ELIGIBILITY_OPTIONS)[number])
  const visibleFeedback = feedbackData?.ai_feedback || shot.ai_feedback || ''
  const feedbackError = feedbackMutation.isError
    ? apiErrorMessage(feedbackMutation.error, 'Failed to generate AI feedback. Please try again.')
    : null

  const submitCorrections = () => {
    if (!hasCorrectionChanges || correctionMutation.isPending) return
    if (!correctionEligibilityValid) {
      setCorrectionFieldError('Shot eligibility must be one of the listed values.')
      return
    }
    setCorrectionFieldError(null)
    correctionMutation.mutate(correctionPayload)
  }

  return (
    <TonePageWrapper ref={routeRef} testId="brew-log-detail">

      {/* ── Nav row: back link + tone toggle ─────────────────────────────── */}
      <div className="kk-b-page__nav">
        {/* AC-15: ← Back text confirmed */}
        <BackLink to={backTarget} />
        <ToneToggle />
      </div>

      {/* ── Single takeover card — ALL brew-log content unified ─────────────── */}
      <TakeoverCard>

        <ShotCard shot={shot} variant="detail-header" />

        {/* Action area: buttons only; shot identity chips live in ShotCard detail-header. */}
        <div className="kk-tc-actions">
          {!correctionOpen && (
            <div className="kk-tc-actions-buttons">
              <ToneButton variant="edit" onClick={openCorrectionForm}>
                {COPY.brewLogDetail.correctTitle}
              </ToneButton>
              <ToneButton
                variant="danger"
                data-testid="delete-shot-trigger"
                onClick={() => {
                  setDeleteError(null)
                  setDeleteOpen(true)
                }}
              >
                {LOCKED_LABELS.delete}
              </ToneButton>
            </div>
          )}
        </div>

        {/* Brew parameters section */}
        <Section>
          <SectionHeader>{COPY.brewLogDetail.shotParameters}</SectionHeader>
          <ParamGrid>
            {shot.dose_in_g != null && (
              <ParamPair label={COPY.fields.dose} value={`${shot.dose_in_g}g`} />
            )}
            {shot.yield_out_g != null && (
              <ParamPair label={COPY.fields.yield} value={`${shot.yield_out_g}g`} />
            )}
            {shot.time_sec != null && (
              <ParamPair label={COPY.fields.time} value={`${shot.time_sec}s`} />
            )}
            {shot.grind_setting && (
              <ParamPair label={COPY.fields.grindSetting} value={shot.grind_setting} />
            )}
            {shot.taste_summary && (
              <ParamPair
                label={COPY.fields.taste}
                value={shot.taste_summary}
                labelTestId="taste-summary-row"
              />
            )}
            {shot.storage_method && (
              <ParamPair label={COPY.fields.storage} value={shot.storage_method} />
            )}
          </ParamGrid>
        </Section>

        {/* Extraction readout section */}
        {(shot.dose_in_g != null || shot.yield_out_g != null || shot.time_sec != null) && (
          <Section>
            <SectionHeader>{COPY.brewLogDetail.extractionShape}</SectionHeader>
            <ExtractionReadout
              doseG={shot.dose_in_g}
              yieldG={shot.yield_out_g}
              timeSec={shot.time_sec}
            />
          </Section>
        )}

        {/* Hardware section */}
        {(shot.machine_name || shot.grinder_name || shot.basket_name) && (
          <Section>
            <SectionHeader>Hardware</SectionHeader>
            <ParamGrid>
              {shot.machine_name && (
                <ParamPair label={COPY.fields.machine} value={shot.machine_name} />
              )}
              {shot.grinder_name && (
                <ParamPair label={COPY.fields.grinder} value={shot.grinder_name} />
              )}
              {shot.basket_name && (
                <ParamPair label={COPY.fields.basket} value={shot.basket_name} />
              )}
            </ParamGrid>
          </Section>
        )}

        {/* Notes section */}
        {shot.user_notes && (
          <Section data-testid="notes-section">
            <SectionHeader>Notes</SectionHeader>
            <p className="kk-tc-body">{shot.user_notes}</p>
          </Section>
        )}

        {/* AI feedback section */}
        <Section>
          <SectionHeader>{COPY.brewLogDetail.aiFeedback}</SectionHeader>
          {visibleFeedback ? (
            <MarkdownProse>{visibleFeedback}</MarkdownProse>
          ) : (
            <p className="kk-tc-body-muted">{COPY.brewLogDetail.noFeedback}</p>
          )}
          {feedbackError && (
            <p role="alert" className="kk-tc-error mt-2">{feedbackError}</p>
          )}
          {feedbackMessage && !feedbackError && (
            <p role="status" className="kk-tc-body-muted mt-2">{feedbackMessage}</p>
          )}
          <div className="mt-3">
            <ToneButton
              variant="edit"
              onClick={() => {
                if (feedbackInFlightRef.current || feedbackMutation.isPending) return
                feedbackInFlightRef.current = true
                feedbackMutation.mutate()
              }}
              disabled={feedbackMutation.isPending}
            >
              {feedbackMutation.isPending
                ? 'Generating…'
                : visibleFeedback ? 'Regenerate AI feedback' : 'Get AI feedback'}
            </ToneButton>
          </div>
        </Section>

        {/* Correction form section — shown inline when open */}
        {correctionOpen && (
          <Section>
            <SectionHeader>{COPY.brewLogDetail.correctFormTitle}</SectionHeader>
            <p className="kk-tc-body-muted kk-tc-form-hint">
              {COPY.brewLogDetail.correctFormHint}
            </p>
            <FormSection>
              <ToneInput
                id="correction-taste-summary"
                label="Taste summary"
                type="text"
                value={correctionForm.taste_summary}
                onChange={(e) => setCorrectionForm((prev) => ({ ...prev, taste_summary: e.target.value }))}
              />
              <ToneInput
                id="correction-grind-setting"
                label="Grind setting"
                type="text"
                value={correctionForm.grind_setting}
                onChange={(e) => setCorrectionForm((prev) => ({ ...prev, grind_setting: e.target.value }))}
              />
              <ToneSelect
                id="correction-shot-eligibility"
                label="Shot eligibility"
                value={correctionForm.shot_eligibility}
                onChange={(e) => {
                  setCorrectionForm((prev) => ({ ...prev, shot_eligibility: e.target.value }))
                  setCorrectionFieldError(null)
                }}
                error={!correctionEligibilityValid ? 'Choose a listed eligibility value.' : null}
                errorId="correction-eligibility-error"
                aria-invalid={!correctionEligibilityValid}
                aria-describedby={!correctionEligibilityValid ? 'correction-eligibility-error' : undefined}
              >
                <option value="">{COPY.brewLogDetail.noEligibility}</option>
                {ELIGIBILITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </ToneSelect>
              <ToneTextarea
                id="correction-user-notes"
                label="Notes"
                rows={3}
                value={correctionForm.user_notes}
                onChange={(e) => setCorrectionForm((prev) => ({ ...prev, user_notes: e.target.value }))}
              />
            </FormSection>
            {correctionFieldError && (
              <p role="alert" className="kk-tc-error mt-3">{correctionFieldError}</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <ToneButton
                variant="edit"
                onClick={() => {
                  setCorrectionOpen(false)
                  setCorrectionFieldError(null)
                }}
                disabled={correctionMutation.isPending}
              >
                Cancel
              </ToneButton>
              <ToneButton
                variant="edit"
                onClick={submitCorrections}
                disabled={!hasCorrectionChanges || !correctionEligibilityValid || correctionMutation.isPending}
              >
                {correctionMutation.isPending ? 'Saving…' : COPY.brewLogDetail.saveCorrections}
              </ToneButton>
            </div>
          </Section>
        )}

      </TakeoverCard>

      {/* Delete dialog — lives outside the card */}
      <AccessibleDialog
        open={deleteOpen}
        title={COPY.brewLog.deleteTitle}
        description={COPY.brewLog.deleteBody}
        size="sm"
        onClose={() => {
          if (deleteMutation.isPending) return
          setDeleteOpen(false)
          setDeleteError(null)
        }}
      >
        <div
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              confirmDelete()
            }
          }}
        >
          {deleteError && (
            <p role="alert" className="text-error text-sm mb-3">{deleteError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDeleteOpen(false)
                setDeleteError(null)
              }}
              disabled={deleteMutation.isPending}
            >
              {COPY.actions.cancel}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              loading={deleteMutation.isPending}
              loadingText={COPY.brewLog.deleting}
            >
              {LOCKED_LABELS.delete}
            </Button>
          </div>
        </div>
      </AccessibleDialog>
    </TonePageWrapper>
  )
}
