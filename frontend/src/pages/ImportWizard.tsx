import { useState } from 'react'
import { createCatalogItem } from '../api/catalog'
import { submitShot } from '../api/brewLog'

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
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
    <div className="p-4 md:p-6 max-w-2xl mx-auto w-full">
      <h1 className="font-display text-3xl md:text-4xl font-bold text-white/80 mb-4">Import</h1>

      {/* Steps indicator */}
      <ul className="steps steps-horizontal w-full mb-8 text-amber-200/60">
        <li className={`step ${step >= 1 ? 'step-primary' : ''}`}>Upload</li>
        <li className={`step ${step >= 2 ? 'step-primary' : ''}`}>Preview</li>
        <li className={`step ${step >= 3 ? 'step-primary' : ''}`}>Done</li>
      </ul>

      {/* Step 1 — Upload */}
      {step === 1 && (
        <div className="glass-card p-6 space-y-4">
          <p className="text-amber-200/70 text-sm">
            Upload a CSV file with catalog items or brew log entries.
          </p>
          <input
            type="file"
            accept=".csv"
            className="file-input file-input-bordered w-full bg-amber-950/60 border-amber-700/40 text-amber-100 input-styled"
            onChange={handleFile}
          />
          <button
            className="btn btn-primary btn-bevel w-full"
            disabled={rows.length === 0}
            onClick={() => setStep(2)}
          >
            {rows.length > 0 ? `Preview ${rows.length} rows` : 'Preview'}
          </button>
        </div>
      )}

      {/* Step 2 — Preview */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="table table-sm text-amber-100 w-full">
              <thead className="text-amber-300/70 text-xs">
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
                    <td className="text-xs text-amber-200/50">{i + 1}</td>
                    <td className="text-xs">{row.type}</td>
                    <td className="text-xs truncate max-w-xs">
                      {row.raw.roaster
                        ? `${row.raw.roaster} — ${row.raw.bean_name}`
                        : row.raw.bag_display || Object.values(row.raw).slice(0, 2).join(', ')}
                    </td>
                    <td>
                      {row.errors.length ? (
                        <span className="badge badge-sm badge-error text-xs">{row.errors[0]}</span>
                      ) : (
                        <span className="badge badge-sm badge-success text-xs">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <button
              className="btn btn-ghost border-amber-600/40 text-amber-400 btn-bevel"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              className="btn btn-primary btn-bevel flex-1"
              disabled={importing || rows.filter((r) => r.errors.length === 0).length === 0}
              onClick={handleImport}
            >
              {importing
                ? 'Importing…'
                : `Import ${rows.filter((r) => r.errors.length === 0).length} valid rows`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Done */}
      {step === 3 && (
        <div className="glass-card p-6 space-y-4 text-center">
          <p className="text-5xl">✓</p>
          <p className="text-lg font-display text-amber-100">Import complete</p>
          <p className="text-sm text-amber-200/70">
            {results.success} row{results.success !== 1 ? 's' : ''} imported successfully
            {results.errors > 0 && `, ${results.errors} failed`}.
          </p>
          <button
            className="btn btn-primary btn-bevel"
            onClick={() => { setStep(1); setRows([]) }}
          >
            Import more
          </button>
        </div>
      )}
    </div>
    </div>
  )
}

