import { useEffect, useRef, useState } from 'react'
import { createCatalogItem } from '../api/catalog'
import { submitShot } from '../api/brewLog'
import { Badge, Button, FormField, GlassCard, PageHeader } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { useKaapiMotion } from '../lib/motion'

type Step = 1 | 2 | 3

interface ParsedRow {
  raw: Record<string, string>
  errors: string[]
  type: 'catalog' | 'brew-log' | 'unknown'
}

const FIELD_GUIDANCE = [
  {
    group: 'Beans / catalog',
    items: [
      ['Roaster', 'who roasted the beans', 'Kaapi Kadai uses this to group catalog entries and shot history', 'the bag label or your old roaster column', 'roaster', 'Blue Tokai'],
      ['Bean name', 'the coffee name', 'this becomes the name people search for later', 'the bag label or product page', 'bean_name', 'Attikan Estate'],
      ['Roast level', 'how light or dark the coffee is', 'used to keep recipes and active bags consistent', 'your notes or the bag label', 'roast_level', 'Medium'],
    ],
  },
  {
    group: 'Shots / brew log',
    items: [
      ['Dose', 'espresso grounds in grams', 'used with yield and time to explain extraction', 'your shot notes', 'dose_in_g', '18'],
      ['Yield', 'espresso out in grams', 'used with dose to show brew ratio', 'your shot notes or scale reading', 'yield_out_g', '38'],
      ['Time', 'how long the shot ran in seconds', 'helps explain fast or slow extractions', 'your timer notes', 'time_sec', '29'],
      ['Grinder', 'equipment or setting used for the shot', 'keeps brew history searchable', 'your recipe notebook', 'grind_setting', '14'],
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

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.3a1 1 0 0 1-1.42.006l-3.3-3.3a1 1 0 1 1 1.414-1.414l2.59 2.59 6.494-6.59a1 1 0 0 1 1.416-.006Z" clipRule="evenodd" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.515 2.625H3.72c-1.345 0-2.188-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
    </svg>
  )
}

/**
 * Accessible segmented progress. Replaces DaisyUI `steps steps-horizontal`, whose
 * fixed per-step min-width and connector lines overflow narrow viewports. Each
 * segment is `flex-1 min-w-0` with a truncating label, so three steps always fit
 * 360px wide without page-level horizontal scroll; `aria-current="step"` and a
 * visually-hidden state announce progress to assistive tech.
 */
function ImportStepper({ step }: { step: Step }) {
  return (
    <nav aria-label="Import progress">
      <ol className="flex items-stretch gap-2">
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as Step
          const done = step > n
          const current = step === n
          const segment = current
            ? 'border-amber-600 bg-[var(--kaapi-content-surface)] text-[var(--kaapi-content-content)]'
            : done
              ? 'border-[var(--kaapi-content-border)] bg-[var(--kaapi-content-surface-2)] text-[var(--kaapi-content-content)]'
              : 'border-[var(--kaapi-content-border)] bg-[var(--kaapi-content-surface)] text-[var(--kaapi-content-muted)]'
          const marker = current
            ? 'bg-amber-700 text-white'
            : done
              ? 'bg-emerald-700 text-white'
              : 'bg-[var(--kaapi-content-surface-2)] text-[var(--kaapi-content-muted)] border border-[var(--kaapi-content-border)]'
          return (
            <li
              key={label}
              aria-current={current ? 'step' : undefined}
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-[var(--bevel-radius)] border px-3 py-2 ${segment}`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${marker}`}>
                {done ? <CheckIcon /> : n}
              </span>
              <span className="min-w-0 truncate text-sm font-medium">{label}</span>
              <span className="sr-only">{done ? '(completed)' : current ? '(current step)' : '(upcoming)'}</span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function rowSummary(row: ParsedRow): string {
  if (row.raw.roaster) return `${row.raw.roaster} — ${row.raw.bean_name}`
  return row.raw.bag_display || Object.values(row.raw).slice(0, 2).join(', ')
}

export default function ImportWizard() {
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
  const { routeEnter, staggerCards, pressFeedback } = useKaapiMotion({ scope: routeRef })

  useEffect(() => {
    if (routeRef.current) routeEnter(routeRef.current)
  }, [routeEnter])

  useEffect(() => {
    const guidanceRows = guidanceRef.current?.querySelectorAll('[data-testid="import-field-guidance"]')
    if (guidanceRows?.length) staggerCards(guidanceRows, 0.035)
  }, [staggerCards])

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

  return (
    <div ref={routeRef} data-testid="motion-route-boundary" className="p-4 md:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Header — espresso-dark frame carries household context (shell-owned identity). */}
        <div data-testid="import-household-header">
          <PageHeader subtitle="IMPORT" title="Bring in your coffee data" />
          <p className="mt-2 text-sm text-amber-200/70">
            Importing into: <span className="font-medium text-amber-100">{activeMembership?.household_name ?? 'Current household'}</span>
          </p>
        </div>

        <ImportStepper step={step} />

        {/* Mobile-first: single column; the lg split is fluid (no fixed grid tracks), and the
            active step leads in DOM so the primary action is first on small screens. */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {step === 1 && (
              <div className="kaapi-content-surface space-y-6 p-4 md:p-6">
                <h2 className="font-display text-lg font-semibold text-[var(--kaapi-content-content)]">Upload file</h2>
                <p className="text-sm leading-6 text-[var(--kaapi-content-muted)]">
                  Choose a CSV exported from your spreadsheet. Kaapi Kadai previews the file first, so you can fix rows before saving anything.
                </p>

                <div className="space-y-1">
                  <a
                    data-testid="import-example-csv-link"
                    href="/templates/kaapi-kadai-import-example.csv"
                    download
                    className="btn btn-outline btn-sm btn-bevel w-full sm:w-auto"
                  >
                    Download example CSV
                  </a>
                  <p className="text-xs text-[var(--kaapi-content-muted)]">Use this as a starting point; it contains fake sample data only.</p>
                </div>

                <FormField label="CSV file" htmlFor="import-csv" required>
                  <input
                    ref={fileInputRef}
                    id="import-csv"
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    onChange={handleFile}
                    aria-describedby="import-csv-hint import-validation-message"
                  />
                  <p id="import-csv-hint" className="mb-2 text-xs text-[var(--kaapi-content-muted)]">
                    Upload a .csv exported from your spreadsheet. You can preview before anything is saved.
                  </p>
                  <div className="input-styled flex flex-col gap-3 rounded-[var(--bevel-radius)] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="truncate text-sm">{selectedFileName}</span>
                    <Button
                      data-testid="import-file-input"
                      type="button"
                      variant="primary"
                      size="sm"
                      onMouseDown={(event) => pressFeedback(event.currentTarget)}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Choose CSV
                    </Button>
                  </div>
                </FormField>

                <p
                  id="import-validation-message"
                  data-testid="import-validation-message"
                  className="rounded-[var(--bevel-radius)] border border-[var(--kaapi-content-border)] bg-[var(--kaapi-content-surface-2)] px-4 py-3 text-sm text-[var(--kaapi-content-content)]"
                >
                  {validationMessage}
                </p>

                {rows.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-[var(--bevel-radius)] border border-dashed border-[var(--kaapi-content-border)] bg-[var(--kaapi-content-surface-2)] px-4 py-8 text-center">
                    <span className="text-3xl" aria-hidden="true">📄</span>
                    <p className="font-medium text-[var(--kaapi-content-content)]">Upload a CSV to unlock preview</p>
                    <p className="text-sm text-[var(--kaapi-content-muted)]">The Preview step becomes available after we detect a header row and at least one data row.</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-[var(--bevel-radius)] border border-[var(--kaapi-content-border)] bg-[var(--kaapi-content-surface-2)] px-4 py-3">
                    <Badge tone="success" emphasis="solid" icon={<CheckIcon />}>Ready</Badge>
                    <span className="text-sm text-[var(--kaapi-content-content)]">
                      {rows.length} row{rows.length !== 1 ? 's' : ''} ready to review before import.
                    </span>
                  </div>
                )}

                <Button variant="primary" fullWidth disabled={rows.length === 0} onClick={() => setStep(2)}>
                  {rows.length > 0 ? `Preview ${rows.length} rows` : 'Preview'}
                </Button>
              </div>
            )}

            {step === 2 && (
              <GlassCard variant="content" padding="lg" className="space-y-6">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="font-display text-lg font-semibold text-[var(--kaapi-content-content)]">Preview rows</h2>
                  <p className="text-sm text-[var(--kaapi-content-muted)]">{validRows} valid · {invalidRows} with issues</p>
                </div>

                {/* Single responsive structure: stacked rows on mobile (no horizontal scroll),
                    a column-priority grid "table" from md up. Long values truncate at md+ and
                    wrap on mobile; per-row errors span the full width so the grid stays compact. */}
                <div className="overflow-hidden rounded-[var(--bevel-radius)] border border-[var(--kaapi-content-border)]">
                  <div className="hidden bg-[var(--kaapi-content-surface-2)] px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-[var(--kaapi-content-muted)] md:grid md:grid-cols-[3rem_8rem_1fr_auto] md:gap-3">
                    <span>#</span>
                    <span>Type</span>
                    <span>Summary</span>
                    <span>Status</span>
                  </div>
                  {rows.map((row, i) => {
                    const ok = row.errors.length === 0
                    return (
                      <div
                        key={i}
                        className="grid grid-cols-1 gap-2 border-t border-[var(--kaapi-content-border)] bg-[var(--kaapi-content-surface)] px-4 py-3 first:border-t-0 md:grid-cols-[3rem_8rem_1fr_auto] md:items-center md:gap-3 md:first:border-t-0"
                      >
                        <span className="text-xs font-medium text-[var(--kaapi-content-muted)] md:text-sm">
                          <span className="md:hidden">Row </span>{i + 1}
                        </span>
                        <div>
                          <Badge tone="neutral" emphasis="solid" className="capitalize">{row.type}</Badge>
                        </div>
                        <p className="min-w-0 break-words text-sm text-[var(--kaapi-content-content)] md:truncate">{rowSummary(row)}</p>
                        <div>
                          {ok ? (
                            <Badge tone="success" emphasis="solid" icon={<CheckIcon />}>Ready</Badge>
                          ) : (
                            <Badge tone="danger" emphasis="solid" icon={<AlertIcon />}>Needs fix</Badge>
                          )}
                        </div>
                        {!ok && (
                          <p data-testid="import-validation-message" className="text-xs text-error md:col-span-4">
                            {row.errors[0]}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setStep(1)}>Back</Button>
                  <Button variant="primary" className="w-full sm:flex-1" disabled={importing || validRows === 0} loading={importing} loadingText="Importing…" onClick={handleImport}>
                    {`Import ${validRows} valid rows`}
                  </Button>
                </div>
                <p className="text-sm leading-6 text-[var(--kaapi-content-muted)]">Rows with issues are skipped so you can fix them in your CSV and try again.</p>
              </GlassCard>
            )}

            {step === 3 && (
              <GlassCard variant="content" padding="lg" className="space-y-4 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-700 text-white" aria-hidden="true">
                  <CheckIcon />
                </span>
                <p className="font-display text-2xl font-bold text-[var(--kaapi-content-content)]">Import complete</p>
                <p className="text-sm leading-6 text-[var(--kaapi-content-muted)]">
                  {results.success} row{results.success !== 1 ? 's' : ''} imported successfully{results.errors > 0 && `, ${results.errors} failed`}.
                </p>
                <Button variant="primary" onClick={() => { setStep(1); setRows([]); setSelectedFileName('No file selected') }}>Import more</Button>
              </GlassCard>
            )}
          </div>

          <aside className="lg:col-span-1">
            <GlassCard variant="content" padding="lg" className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-[var(--kaapi-content-content)]">What each column means</h2>
              <div ref={guidanceRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {FIELD_GUIDANCE.map((group) => (
                  <div key={group.group} className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--kaapi-content-muted)]">{group.group}</h3>
                    {group.items.map(([label, what, why, where, raw, example]) => (
                      <div key={raw} data-testid="import-field-guidance" className="rounded-[var(--bevel-radius)] border border-[var(--kaapi-content-border)] bg-[var(--kaapi-content-surface-2)] p-4">
                        <p className="font-medium text-[var(--kaapi-content-content)]">{label} <span className="font-normal text-[var(--kaapi-content-muted)]">— {what}.</span></p>
                        <p className="mt-1 text-sm leading-6 text-[var(--kaapi-content-muted)]">{why}. Find it in {where}.</p>
                        <p className="mt-2 text-xs text-[var(--kaapi-content-muted)]">
                          <code className="rounded border border-[var(--kaapi-content-border)] bg-[var(--kaapi-content-surface)] px-1.5 py-0.5 font-mono text-[var(--kaapi-content-content)]">{raw}</code> Example: <span className="text-[var(--kaapi-content-content)]">{example}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </GlassCard>
          </aside>
        </div>
      </div>
    </div>
  )
}
