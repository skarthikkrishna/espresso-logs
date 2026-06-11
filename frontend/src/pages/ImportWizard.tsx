import { useState } from 'react'
import { createCatalogItem } from '../api/catalog'
import { submitShot } from '../api/brewLog'
import {
  Button,
  EmptyState,
  FormField,
  GlassCard,
  Input,
  PageHeader,
  SectionHeading,
} from '../components/ui'

type Step = 1 | 2 | 3

interface ParsedRow {
  raw: Record<string, string>
  errors: string[]
  type: 'catalog' | 'brew-log' | 'unknown'
}

function detectType(row: Record<string, string>): ParsedRow['type'] {
  if (row.roaster && row.bean_name) return 'catalog'
  if (row.bag_display || row.date) return 'brew-log'
  return 'unknown'
}

function validateRow(row: Record<string, string>): string[] {
  const errors: string[] = []
  const type = detectType(row)
  if (type === 'catalog') {
    if (!row.roaster) errors.push('Missing: roaster')
    if (!row.bean_name) errors.push('Missing: bean name')
    if (!row.roast_level) errors.push('Missing: roast level')
  } else if (type === 'brew-log') {
    if (!row.bag_display) errors.push('Missing: bag display')
    if (!row.date) errors.push('Missing: date')
  } else {
    errors.push('Cannot determine row type')
  }
  return errors
}

export default function ImportWizard() {
  const [step, setStep] = useState<Step>(1)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [results, setResults] = useState({ success: 0, errors: 0 })
  const [importing, setImporting] = useState(false)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      const lines = text.split('\n').filter(Boolean)
      if (lines.length < 2) return
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
      const parsed: ParsedRow[] = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim())
        const raw: Record<string, string> = {}
        headers.forEach((h, i) => { raw[h] = values[i] ?? '' })
        return { raw, type: detectType(raw), errors: validateRow(raw) }
      })
      setRows(parsed)
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

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
        <PageHeader
          title="Import"
          subtitle="Catalog and brew logs"
        />

        <GlassCard padding="lg" className="space-y-4">
          <SectionHeading title="What your CSV should include" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-2xl border border-amber-500/15 bg-amber-950/30 p-4">
              <h3 className="text-base font-semibold text-amber-100">Catalog CSV</h3>
              <p className="text-sm leading-6 text-amber-100/80">
                Include the columns <code className="rounded bg-black/20 px-1 py-0.5 text-amber-100">roaster</code>,{' '}
                <code className="rounded bg-black/20 px-1 py-0.5 text-amber-100">bean_name</code>, and{' '}
                <code className="rounded bg-black/20 px-1 py-0.5 text-amber-100">roast_level</code>.
                You can also add{' '}
                <code className="rounded bg-black/20 px-1 py-0.5 text-amber-100">product_url</code>.
              </p>
            </div>
            <div className="space-y-2 rounded-2xl border border-amber-500/15 bg-amber-950/30 p-4">
              <h3 className="text-base font-semibold text-amber-100">Brew log CSV</h3>
              <p className="text-sm leading-6 text-amber-100/80">
                Include <code className="rounded bg-black/20 px-1 py-0.5 text-amber-100">bag_display</code> or{' '}
                <code className="rounded bg-black/20 px-1 py-0.5 text-amber-100">bag_id</code>, plus{' '}
                <code className="rounded bg-black/20 px-1 py-0.5 text-amber-100">date</code>. Optional fields include{' '}
                <code className="rounded bg-black/20 px-1 py-0.5 text-amber-100">dose_in_g</code>,{' '}
                <code className="rounded bg-black/20 px-1 py-0.5 text-amber-100">yield_out_g</code>,{' '}
                <code className="rounded bg-black/20 px-1 py-0.5 text-amber-100">time_sec</code>,{' '}
                <code className="rounded bg-black/20 px-1 py-0.5 text-amber-100">grind_setting</code>, and{' '}
                <code className="rounded bg-black/20 px-1 py-0.5 text-amber-100">shot_eligibility</code>.
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="md">
          <ul className="steps steps-horizontal w-full text-sm text-amber-200/70">
            <li className={`step ${step >= 1 ? 'step-primary' : ''}`}>Upload</li>
            <li className={`step ${step >= 2 ? 'step-primary' : ''}`}>Preview</li>
            <li className={`step ${step >= 3 ? 'step-primary' : ''}`}>Done</li>
          </ul>
        </GlassCard>

        {step === 1 && (
          <GlassCard padding="lg" className="space-y-6">
            <SectionHeading title="Upload file" />
            <p className="text-sm leading-6 text-amber-100/80">
              Choose a CSV export for catalog items or brew log entries. Your file is parsed first so you can preview rows and spot issues before anything is imported.
            </p>

            <FormField
              label="CSV file"
              htmlFor="import-csv"
              required
              hint="Upload a .csv exported from your spreadsheet. You can preview before anything is saved."
            >
              <Input
                id="import-csv"
                type="file"
                accept=".csv"
                onChange={handleFile}
                data-testid="import-file-input"
                className="h-auto py-3 file:mr-4 file:cursor-pointer file:rounded-[var(--bevel-radius)] file:border-0 file:bg-primary file:px-4 file:py-2 file:font-semibold file:text-primary-content hover:file:bg-primary/90"
              />
            </FormField>

            {rows.length === 0 ? (
              <EmptyState
                icon={<span className="text-3xl">📄</span>}
                title="Upload a CSV to unlock preview"
                description="The Preview step becomes available after we detect a header row and at least one data row in your file."
              />
            ) : (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {rows.length} row{rows.length !== 1 ? 's' : ''} ready to review before import.
              </div>
            )}

            <div className="space-y-2">
              <Button
                variant="primary"
                fullWidth
                disabled={rows.length === 0}
                onClick={() => setStep(2)}
              >
                {rows.length > 0 ? `Preview ${rows.length} rows` : 'Preview'}
              </Button>
              <p className="text-center text-sm text-amber-200/70">
                {rows.length > 0
                  ? 'Preview each row before sending valid entries to your account.'
                  : 'Preview stays disabled until you select a CSV with data.'}
              </p>
            </div>
          </GlassCard>
        )}

        {step === 2 && (
          <GlassCard padding="lg" className="space-y-6">
            <SectionHeading
              title="Preview rows"
              actions={(
                <p className="text-sm text-amber-200/70">
                  {rows.filter((row) => row.errors.length === 0).length} valid • {rows.filter((row) => row.errors.length > 0).length} with issues
                </p>
              )}
            />

            <div className="overflow-x-auto rounded-2xl border border-amber-700/20">
              <table className="table w-full text-sm text-amber-100">
                <thead className="text-sm text-amber-300/80">
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Summary</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-amber-700/20">
                      <td className="text-sm text-amber-200/60">{i + 1}</td>
                      <td className="text-sm capitalize">{row.type}</td>
                      <td className="max-w-xs truncate text-sm">
                        {row.raw.roaster
                          ? `${row.raw.roaster} — ${row.raw.bean_name}`
                          : row.raw.bag_display || Object.values(row.raw).slice(0, 2).join(', ')}
                      </td>
                      <td>
                        {row.errors.length ? (
                          <span className="inline-flex rounded-full bg-red-500/15 px-3 py-1 text-sm font-medium text-red-200">
                            {row.errors[0]}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-200">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                variant="primary"
                className="w-full sm:flex-1"
                disabled={importing || rows.filter((r) => r.errors.length === 0).length === 0}
                loading={importing}
                loadingText="Importing…"
                onClick={handleImport}
              >
                {`Import ${rows.filter((r) => r.errors.length === 0).length} valid rows`}
              </Button>
            </div>

            <p className="text-sm leading-6 text-amber-200/70">
              Rows with validation issues will be skipped during import.
            </p>
          </GlassCard>
        )}

        {step === 3 && (
          <GlassCard padding="lg" className="space-y-4 text-center">
            <p className="text-5xl">✓</p>
            <p className="font-display text-2xl text-amber-100">Import complete</p>
            <p className="text-sm leading-6 text-amber-200/80">
              {results.success} row{results.success !== 1 ? 's' : ''} imported successfully
              {results.errors > 0 && `, ${results.errors} failed`}.
            </p>
            <Button
              variant="primary"
              onClick={() => { setStep(1); setRows([]) }}
            >
              Import more
            </Button>
          </GlassCard>
        )}
      </div>
    </div>
  )
}
