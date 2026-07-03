import { useEffect, useRef, useState } from 'react'
import { createCatalogItem } from '../api/catalog'
import { submitShot } from '../api/brewLog'
import { startImportWizard } from '../api/importWizard'
import { useAuth } from '../contexts/AuthContext'
import { useKaapiMotion } from '../lib/motion'
import { COPY } from '../copy'
import {
  EntityFormActions,
  ImportPreviewRows,
  ToneButton,
  ToneLinkAction,
  ToneProvider,
  ToneStepper,
  WizardShell,
} from '../components/tone-system'
import type { ParsedRow } from '../components/tone-system'

type Step = 1 | 2 | 3

const FIELD_GUIDANCE = [
  {
    group: 'Beans / catalog',
    items: [
      ['Roaster', 'Who roasted the beans', 'Kaapi Kadai uses this to group catalog entries and shot history', 'the bag label or your old roaster column', 'roaster', 'Blue Tokai'],
      ['Bean name', 'The coffee name', 'This becomes the name people search for later', 'the bag label or product page', 'bean_name', 'Attikan Estate'],
      ['Roast level', 'How light or dark the coffee is', 'Used to keep recipes and active bags consistent', 'your notes or the bag label', 'roast_level', 'Medium'],
    ],
  },
  {
    group: 'Shots / brew log',
    items: [
      ['Dose', 'Espresso grounds in grams', 'Used with yield and time to explain extraction', 'your shot notes', 'dose_in_g', '18'],
      ['Yield', 'Espresso out in grams', 'Used with dose to show brew ratio', 'your shot notes or scale reading', 'yield_out_g', '38'],
      ['Time', 'How long the shot ran in seconds', 'Helps explain fast or slow extractions', 'your timer notes', 'time_sec', '29'],
      ['Grinder', 'Equipment or setting used for the shot', 'Keeps brew history searchable', 'your recipe notebook', 'grind_setting', '14'],
    ],
  },
]

const STEP_LABELS = ['Upload', 'Preview', 'Done'] as const

function detectType(row: Record<string, string>): ParsedRow['type'] {
  if (row.roaster && row.bean_name) return 'catalog'
  if (row.bag_display || row.date) return 'brew-log'
  return 'unknown'
}

function validateRow(row: Record<string, string>): string[] {
  const errors: string[] = []
  const type = detectType(row)
  if (type === 'catalog') {
    if (!row.roaster) errors.push('Add a roaster so this bean can be grouped in the catalog.')
    if (!row.bean_name) errors.push('Add a bean name so people can recognize this coffee.')
    if (!row.roast_level) errors.push('Add a roast level such as Light, Medium, or Dark.')
  } else if (type === 'brew-log') {
    if (!row.bag_display) errors.push('Add the bag name this shot belongs to, for example Blue Tokai — Attikan Estate.')
    if (!row.date) errors.push('Add the shot date so the brew appears in history.')
  } else {
    errors.push('Add either roaster + bean name for catalog rows, or bag name + date for shot rows.')
  }
  return errors
}

/**
 * ImportWizard — outer wrapper providing ToneProvider so WizardShell and
 * tone-system components receive the tone context they need. The page logic
 * lives in ImportWizardPage.
 */
export default function ImportWizard() {
  return (
    <ToneProvider>
      <ImportWizardPage />
    </ToneProvider>
  )
}

function ImportWizardPage() {
  const [step, setStep] = useState<Step>(1)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [results, setResults] = useState({ success: 0, errors: 0 })
  const [importing, setImporting] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState('No file selected')
  const [validationMessage, setValidationMessage] = useState('Choose a CSV to preview rows before anything is saved.')
  const { activeMembership } = useAuth()
  const routeRef = useRef<HTMLDivElement>(null)
  const guidanceRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLSpanElement>(null)
  const hasMountedRef = useRef(false)
  const { routeEnter, staggerCards, pressFeedback } = useKaapiMotion({ scope: routeRef })

  useEffect(() => {
    if (routeRef.current) routeEnter(routeRef.current)
  }, [routeEnter])

  useEffect(() => {
    void startImportWizard().catch(() => undefined)
  }, [])

  useEffect(() => {
    const guidanceRows = guidanceRef.current?.querySelectorAll('[data-testid="import-field-guidance"]')
    if (guidanceRows?.length) staggerCards(guidanceRows, 0.035)
  }, [staggerCards])

  // Programmatic focus on step transition — accessible navigation (spec §4.3)
  // Skip initial mount so the wizard title isn't focused on first page load.
  useEffect(() => {
    if (!hasMountedRef.current) { hasMountedRef.current = true; return }
    headingRef.current?.focus()
  }, [step])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFileName(file.name)
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      const lines = text.split('\n').filter(Boolean)
      if (lines.length < 2) {
        setRows([])
        setValidationMessage('This CSV needs a header row and at least one data row before preview can start.')
        return
      }
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
      const parsed: ParsedRow[] = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim())
        const raw: Record<string, string> = {}
        headers.forEach((h, i) => { raw[h] = values[i] ?? '' })
        return { raw, type: detectType(raw), errors: validateRow(raw) }
      })
      setRows(parsed)
      setValidationMessage(`${parsed.length} row${parsed.length !== 1 ? 's' : ''} ready to preview. Rows with issues will be explained before import.`)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    setImporting(true)
    let success = 0
    let errors = 0
    for (const row of rows.filter((r) => r.errors.length === 0)) {
      try {
        if (row.type === 'catalog') {
          await createCatalogItem({
            roaster: row.raw.roaster,
            bean_name: row.raw.bean_name,
            roast_level: row.raw.roast_level,
            product_url: row.raw.product_url || undefined,
          })
        } else if (row.type === 'brew-log') {
          await submitShot({
            bag_id: row.raw.bag_id || row.raw.bag_display || '',
            dose_in_g: row.raw.dose_in_g ? parseFloat(row.raw.dose_in_g) : null,
            yield_out_g: row.raw.yield_out_g ? parseFloat(row.raw.yield_out_g) : null,
            time_sec: row.raw.time_sec ? parseInt(row.raw.time_sec, 10) : null,
            grind_setting: row.raw.grind_setting || '',
            shot_eligibility: row.raw.shot_eligibility || '',
            idempotency_key: crypto.randomUUID(),
          })
        }
        success++
      } catch {
        errors++
      }
    }
    setResults({ success, errors })
    setImporting(false)
    setStep(3)
  }

  const validRows = rows.filter((row) => row.errors.length === 0).length
  const invalidRows = rows.length - validRows

  // Field guidance aside — shown on all steps
  const guidanceAside = (
    <div className="detail-panel space-y-4 p-4 md:p-6">
      <h2 className="kk-tc-section-header">
        {COPY.import.columnsTitle}
      </h2>
      <div ref={guidanceRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        {FIELD_GUIDANCE.map((group) => (
          <div key={group.group} className="space-y-3">
            <h3 className="kk-import-guidance-group-label">
              {group.group}
            </h3>
            {group.items.map(([label, what, why, where, raw, example]) => (
              <div
                key={raw}
                data-testid="import-field-guidance"
                className="kk-import-guidance-row"
              >
                <p className="kk-import-guidance-field-name">
                  {label}{' '}
                  <span className="kk-import-guidance-definition">— {what}.</span>
                </p>
                <p className="kk-tc-body-muted kk-import-guidance-copy">
                  {COPY.import.fieldWhere(why, where)}
                </p>
                <p className="kk-import-caption">
                  <code className="kk-import-code">
                    {raw}
                  </code>{' '}
                  {COPY.import.example}{' '}
                  <span className="kk-import-caption-strong">{example}</span>
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )

  // Step 2 actions — passed to WizardShell actions slot
  const step2Actions =
    step === 2 ? (
      <EntityFormActions
        primaryLabel={`Import ${validRows} valid rows`}
        primaryType="button"
        onPrimary={handleImport}
        secondaryLabel="Back"
        onSecondary={() => { setStep(1) }}
        isSubmitting={importing}
        disabled={validRows === 0}
        statusMessage={importing ? 'Importing…' : undefined}
      />
    ) : undefined

  return (
    <div ref={routeRef} data-testid="motion-route-boundary">
      <WizardShell
        backTo="/import"
        eyebrow="Import"
        title={COPY.import.title}
        subtitle={
          <>
            {COPY.import.importingInto}{' '}
            <span className="kk-import-subtitle-household">
              {activeMembership?.household_name ?? 'Current household'}
            </span>
          </>
        }
        stepper={
          <ToneStepper
            stepLabels={STEP_LABELS}
            currentStep={step}
            aria-label={COPY.import.progressAria}
          />
        }
        aside={guidanceAside}
        actions={step2Actions}
        headingRef={headingRef}
        testId="import-wizard"
      >
        {/* Step 1 — Upload */}
        {step === 1 && (
          <div className="detail-panel space-y-6 p-4 md:p-6">
            <h2 className="kk-tc-section-header">
              {COPY.import.uploadFile}
            </h2>
            <p className="kk-tc-body-muted">
              {COPY.import.uploadIntro}
            </p>

            <div className="space-y-1">
              <ToneLinkAction
                data-testid="import-example-csv-link"
                href="/templates/kaapi-kadai-import-example.csv"
                download
                className="min-h-11 w-full justify-center sm:w-auto"
              >
                {COPY.import.downloadExample}
              </ToneLinkAction>
              <p className="kk-import-caption">{COPY.import.exampleNote}</p>
            </div>

            {/* File input — hidden input triggered by ToneButton */}
            <div>
              <label
                htmlFor="import-csv"
                className="kk-tc-field-label"
              >
                {COPY.import.csvFileLabel} <span aria-hidden="true">*</span>
              </label>
              <input
                ref={fileInputRef}
                id="import-csv"
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={handleFile}
                aria-describedby="import-csv-hint import-validation-message"
              />
              <p id="import-csv-hint" className="kk-import-caption kk-import-file-hint">
                {COPY.import.uploadHint}
              </p>
              <div className="kk-import-file-row flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="kk-tc-body truncate">{selectedFileName}</span>
                <ToneButton
                  data-testid="import-file-input"
                  variant="primary"
                  onMouseDown={(event) => pressFeedback(event.currentTarget)}
                  onClick={() => { fileInputRef.current?.click() }}
                >
                  {COPY.import.chooseCsv}
                </ToneButton>
              </div>
            </div>

            <p
              id="import-validation-message"
              data-testid="import-validation-message"
              className="kk-tc-body-muted kk-import-inline-hint"
            >
              {validationMessage}
            </p>

            {rows.length > 0 && (
              <div className="kk-import-inline-status">
                <span className="kk-tc-body">
                  {COPY.import.readyToReview(rows.length)}
                </span>
              </div>
            )}

            <div className="sm:flex sm:justify-end">
              <ToneButton
                variant="primary"
                disabled={rows.length === 0}
                onClick={() => { setStep(2) }}
                className="w-full sm:w-auto"
              >
                {rows.length > 0 ? `Preview ${rows.length} rows` : 'Preview'}
              </ToneButton>
            </div>
          </div>
        )}

        {/* Step 2 — Preview */}
        {step === 2 && (
          <div className="detail-panel space-y-6 p-4 md:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="kk-tc-section-header">
                {COPY.import.previewRows}
              </h2>
              <p className="kk-tc-body-muted">
                {COPY.import.validityCount(validRows, invalidRows)}
              </p>
            </div>

            <ImportPreviewRows rows={rows} />

            <p className="kk-tc-body-muted">
              {COPY.import.skipNote}
            </p>
          </div>
        )}

        {/* Step 3 — Done */}
        {step === 3 && (
          <div className="detail-panel space-y-4 p-4 text-center md:p-6">
            <span
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--kk-chip-success-bg)] text-[var(--kk-chip-success-text)]"
              aria-hidden="true"
            >
              ✓
            </span>
            <p className="kk-import-result-title">
              {COPY.import.complete}
            </p>
            <p className="kk-tc-body-muted">
              {COPY.import.completeSummary(results.success, results.errors)}
            </p>
            <ToneButton
              variant="primary"
              onClick={() => {
                setStep(1)
                setRows([])
                setSelectedFileName('No file selected')
              }}
            >
              {COPY.import.importMore}
            </ToneButton>
          </div>
        )}
      </WizardShell>
    </div>
  )
}
