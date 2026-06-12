import { useEffect, useRef, useState } from 'react'
import { createCatalogItem } from '../api/catalog'
import { submitShot } from '../api/brewLog'
import { Button, EmptyState, FormField, GlassCard, PageHeader, SectionHeading } from '../components/ui'
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
    const rows = guidanceRef.current?.querySelectorAll('[data-testid="import-field-guidance"]')
    if (rows?.length) staggerCards(rows, 0.035)
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
    <div ref={routeRef} data-testid="motion-route-boundary" className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
        <div data-testid="import-household-header">
          <PageHeader subtitle="IMPORT" title="Bring in your coffee data" />
          <p className="mt-2 text-sm text-amber-200/70">Importing into: <span className="font-medium text-amber-100">{activeMembership?.household_name ?? 'Current household'}</span></p>
        </div>

        <GlassCard padding="md">
          <ul className="steps steps-horizontal w-full text-sm text-amber-200/70">
            <li className={`step ${step >= 1 ? 'step-primary' : ''}`}>Upload</li>
            <li className={`step ${step >= 2 ? 'step-primary' : ''}`}>Preview</li>
            <li className={`step ${step >= 3 ? 'step-primary' : ''}`}>Done</li>
          </ul>
        </GlassCard>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
          <GlassCard padding="lg" className="space-y-4">
            <SectionHeading title="What each column means" />
            <div ref={guidanceRef} className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              {FIELD_GUIDANCE.map((group) => (
                <div key={group.group} className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300/70">{group.group}</h3>
                  {group.items.map(([label, what, why, where, raw, example]) => (
                    <div key={raw} data-testid="import-field-guidance" className="rounded-[var(--bevel-radius)] border border-amber-500/15 bg-amber-950/25 p-4">
                      <p className="font-medium text-amber-100">{label} <span className="font-normal text-amber-200/70">— {what}.</span></p>
                      <p className="mt-1 text-sm leading-6 text-amber-100/76">{why}. Find it in {where}.</p>
                      <p className="mt-2 text-xs text-amber-200/55"><code className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-amber-100/80">{raw}</code> Example: <span className="text-amber-100">{example}</span></p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </GlassCard>

          <div className="space-y-6">
            {step === 1 && (
              <GlassCard padding="lg" className="space-y-6">
                <SectionHeading title="Upload file" />
                <p className="text-sm leading-6 text-amber-100/80">
                  Choose a CSV exported from your spreadsheet. Kaapi Kadai previews the file first, so you can fix rows before saving anything.
                </p>

                <a
                  data-testid="import-example-csv-link"
                  href="/templates/kaapi-kadai-import-example.csv"
                  download
                  className="btn btn-outline btn-sm btn-bevel w-full text-amber-100 sm:w-auto"
                >
                  Download example CSV
                </a>
                <p className="text-xs text-amber-200/60">Use this as a starting point; it contains fake sample data only.</p>

                <FormField
                  label="CSV file"
                  htmlFor="import-csv"
                  required
                  hint="Upload a .csv exported from your spreadsheet. You can preview before anything is saved."
                >
                  <input
                    ref={fileInputRef}
                    id="import-csv"
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    onChange={handleFile}
                    aria-describedby="import-validation-message"
                  />
                  <div className="input-styled flex flex-col gap-3 rounded-[var(--bevel-radius)] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="truncate text-sm text-amber-100/80">{selectedFileName}</span>
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

                <p id="import-validation-message" data-testid="import-validation-message" className="rounded-[var(--bevel-radius)] border border-amber-500/20 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/80">
                  {validationMessage}
                </p>

                {rows.length === 0 ? (
                  <EmptyState
                    icon={<span className="text-3xl">📄</span>}
                    title="Upload a CSV to unlock preview"
                    description="The Preview step becomes available after we detect a header row and at least one data row."
                  />
                ) : (
                  <div className="rounded-[var(--bevel-radius)] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    {rows.length} row{rows.length !== 1 ? 's' : ''} ready to review before import.
                  </div>
                )}

                <Button variant="primary" fullWidth disabled={rows.length === 0} onClick={() => setStep(2)}>
                  {rows.length > 0 ? `Preview ${rows.length} rows` : 'Preview'}
                </Button>
              </GlassCard>
            )}

            {step === 2 && (
              <GlassCard padding="lg" className="space-y-6">
                <SectionHeading
                  title="Preview rows"
                  actions={<p className="text-sm text-amber-200/70">{validRows} valid • {invalidRows} with issues</p>}
                />

                <div className="overflow-x-auto rounded-[var(--bevel-radius)] border border-amber-700/20">
                  <table className="table w-full text-sm text-amber-100">
                    <thead className="text-sm text-amber-300/80">
                      <tr><th>#</th><th>Type</th><th>Summary</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className="border-amber-700/20">
                          <td className="text-sm text-amber-200/60">{i + 1}</td>
                          <td className="text-sm capitalize">{row.type}</td>
                          <td className="max-w-xs truncate text-sm">
                            {row.raw.roaster ? `${row.raw.roaster} — ${row.raw.bean_name}` : row.raw.bag_display || Object.values(row.raw).slice(0, 2).join(', ')}
                          </td>
                          <td>
                            {row.errors.length ? (
                              <span data-testid="import-validation-message" className="inline-flex rounded-[var(--bevel-radius)] bg-red-500/15 px-3 py-1 text-sm font-medium text-red-200">
                                {row.errors[0]}
                              </span>
                            ) : (
                              <span className="inline-flex rounded-[var(--bevel-radius)] bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-200">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setStep(1)}>Back</Button>
                  <Button variant="primary" className="w-full sm:flex-1" disabled={importing || validRows === 0} loading={importing} loadingText="Importing…" onClick={handleImport}>
                    {`Import ${validRows} valid rows`}
                  </Button>
                </div>
                <p className="text-sm leading-6 text-amber-200/70">Rows with issues are skipped so you can fix them in your CSV and try again.</p>
              </GlassCard>
            )}

            {step === 3 && (
              <GlassCard padding="lg" className="space-y-4 text-center">
                <p className="text-5xl">✓</p>
                <p className="font-display text-2xl text-amber-100">Import complete</p>
                <p className="text-sm leading-6 text-amber-200/80">
                  {results.success} row{results.success !== 1 ? 's' : ''} imported successfully{results.errors > 0 && `, ${results.errors} failed`}.
                </p>
                <Button variant="primary" onClick={() => { setStep(1); setRows([]); setSelectedFileName('No file selected') }}>Import more</Button>
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
