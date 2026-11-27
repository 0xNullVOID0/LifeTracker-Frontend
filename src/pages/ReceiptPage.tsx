import {type ChangeEvent, useEffect, useRef, useState} from 'react'
import {scanReceiptNutrition} from '../api/receipts.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import {prepareReceiptImage} from '../receiptImage.ts'
import type {EnrichedReceiptItem, EnrichedReceiptResponse, FoodNutrients, ReceiptNutrient} from '../types/receipt.ts'
import {GarminNav} from './NavBar.tsx'

function formatAmount(value: number | null | undefined, currency: string | null): string {
  if (value == null) return '—'
  return currency ? `${value.toFixed(2)} ${currency}` : value.toFixed(2)
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(undefined, {hour12: false})
}

function formatNumber(value: number, digits = 2): string {
  return String(Number(value.toFixed(digits)))
}

// nutrients are per-100 g; macros we surface in the row, rest lives in <details>
const MACROS = [
  {label: 'Energy', name: 'energy', fallbackUnit: 'kcal'},
  {label: 'Protein', name: 'protein', fallbackUnit: 'g'},
  {label: 'Fat', name: 'fat', fallbackUnit: 'g'},
  {label: 'Carbs', name: 'carbohydrate', fallbackUnit: 'g'},
  {label: 'Fiber', name: 'fiber', fallbackUnit: 'g'},
]

function findMacro(nutrients: FoodNutrients | null, name: string): ReceiptNutrient | undefined {
  // catalog names can carry suffixes ("Carbohydrate, total"); try exact first, then prefix
  return nutrients?.nutrients.find((n) => n.name.toLowerCase() === name)
    ?? nutrients?.nutrients.find((n) => n.name.toLowerCase().startsWith(`${name},`))
}

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

type ExportNutrient = {name: string; unit: string; amount: number}

type ExportRow = {
  raw_text: string
  name: string
  brand: string | null
  quantity: number | null
  weight_grams: number | null
  price: number | null
  matched_food: string | null
  matched_source: string | null
  matched_query: string | null
  basis_grams: number
  energy: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  fiber: number | null
  // full per-100 g nutrient list, normalized when the basis is not 100 g
  nutrients: ExportNutrient[]
}

function round2(value: number): number {
  return Number(value.toFixed(2))
}

// one flat record per receipt line, with the candidate the user picked
function exportRows(result: EnrichedReceiptResponse, matches: Record<string, number>): ExportRow[] {
  return result.items.map((item) => {
    const candidate = item.candidates[matches[item.raw_text] ?? 0]
    const nutrients = candidate?.nutrients ?? null
    const basis = nutrients?.basis?.weight_grams ?? 100
    // the payload is per `basis` grams; scale to a true per-100 g column
    const to100 = (amount: number) => round2(basis === 100 ? amount : amount * (100 / basis))
    const macro = (name: string) => {
      const entry = findMacro(nutrients, name)
      return entry ? to100(entry.amount) : null
    }
    return {
      raw_text: item.raw_text,
      name: item.name,
      brand: item.brand ?? null,
      quantity: item.quantity ?? null,
      weight_grams: item.weight_grams ?? null,
      price: item.price ?? null,
      matched_food: candidate?.name ?? null,
      matched_source: candidate?.source ?? null,
      matched_query: candidate?.query ?? null,
      basis_grams: 100,
      energy: macro('energy'),
      protein: macro('protein'),
      fat: macro('fat'),
      carbs: macro('carbohydrate'),
      fiber: macro('fiber'),
      nutrients: (nutrients?.nutrients ?? []).map((n) => ({name: n.name, unit: n.unit, amount: to100(n.amount)})),
    }
  })
}

// union of nutrient names across all rows, keeping first-seen order and unit
function nutrientColumns(rows: ExportRow[]): {name: string; unit: string}[] {
  const columns: {name: string; unit: string}[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const nutrient of row.nutrients) {
      const key = nutrient.name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      columns.push({name: nutrient.name, unit: nutrient.unit})
    }
  }
  return columns
}

function buildReceiptCsv(result: EnrichedReceiptResponse, matches: Record<string, number>): string {
  const rows = exportRows(result, matches)
  const columns = nutrientColumns(rows)
  const header = [
    'raw_text', 'name', 'brand', 'quantity', 'weight_grams', 'price',
    'matched_food', 'matched_source', 'matched_query',
    'energy_kcal_per_100g', 'protein_g_per_100g', 'fat_g_per_100g', 'carbs_g_per_100g', 'fiber_g_per_100g',
    ...columns.map((c) => `${c.name}${c.unit ? ` (${c.unit})` : ''} per_100g`),
  ]
  const body = rows.map((row) => {
    const byName = new Map(row.nutrients.map((n) => [n.name.toLowerCase(), n.amount]))
    return [
      row.raw_text, row.name, row.brand, row.quantity, row.weight_grams, row.price,
      row.matched_food, row.matched_source, row.matched_query,
      row.energy, row.protein, row.fat, row.carbs, row.fiber,
      ...columns.map((c) => byName.get(c.name.toLowerCase()) ?? null),
    ]
  })
  return [header, ...body]
    .map((line) => line.map(csvCell).join(','))
    .join('\r\n')
}

function buildReceiptJson(result: EnrichedReceiptResponse, matches: Record<string, number>): string {
  return JSON.stringify({receipt: result.receipt, items: exportRows(result, matches), skipped: result.skipped}, null, 2)
}

// a markdown table cell must stay on one line: collapse all whitespace
// (receipt lines often wrap, e.g. "Po o Romano DOP\n 'TING 25%") and escape pipes
function mdCell(value: string | null | undefined): string {
  if (value == null || value === '') return '—'
  return value.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|')
}

function formatNutrient(name: string, amount: number, unit: string): string {
  const digits = Math.abs(amount) >= 100 ? 0 : 2
  return `${name}: ${Number(amount.toFixed(digits))}${unit ? ` ${unit}` : ''}`
}

function buildReceiptMarkdown(result: EnrichedReceiptResponse, matches: Record<string, number>): string {
  const r = result.receipt
  const rows = exportRows(result, matches)
  const lines: string[] = ['# Receipt scan']
  if (r) {
    lines.push('', `- **Store:** ${mdCell(r.store)}${r.location ? `, ${mdCell(r.location)}` : ''}`)
    lines.push(`- **Purchased:** ${mdCell(r.purchased_at)}${r.timestamp_is_guess ? ' (guessed)' : ''}`)
    lines.push(`- **Total:** ${r.total ?? '—'}${r.currency ? ` ${r.currency}` : ''}`)
  }
  lines.push('', '## Items', '', '| Receipt line | Matched food | Energy | Protein | Fat | Carbs | Fiber |', '|---|---|---|---|---|---|---|')
  for (const row of rows) {
    const cell = (v: number | null) => (v == null ? '—' : String(v))
    const food = row.matched_food ? `${row.matched_food}${row.matched_source ? ` (${row.matched_source})` : ''}` : null
    lines.push(`| ${mdCell(row.raw_text)} | ${mdCell(food)} | ${cell(row.energy)} | ${cell(row.protein)} | ${cell(row.fat)} | ${cell(row.carbs)} | ${cell(row.fiber)} |`)
  }
  lines.push('', '_Macros are per 100 g._')

  if (result.skipped.length) {
    lines.push('', '## Skipped', '')
    for (const s of result.skipped) lines.push(`- ${mdCell(s.raw_text || s.name)} — ${mdCell(s.reason)}`)
  }

  // detailed table last: only items that carry micronutrients beyond the macros
  const isMacroNutrient = (name: string) => {
    const lower = name.toLowerCase()
    return MACROS.some((macro) => lower === macro.name || lower.startsWith(`${macro.name},`))
  }
  const withMicros = rows.filter((row) => row.nutrients.some((nutrient) => !isMacroNutrient(nutrient.name)))
  if (withMicros.length) {
    const columns = nutrientColumns(withMicros)
    const header = ['Receipt line', 'Matched food', ...columns.map((c) => `${c.name}${c.unit ? ` (${c.unit})` : ''}`)]
    lines.push('', '## Nutrient detail', '', '_Per 100 g, items with micronutrients only._', '')
    lines.push(`| ${header.join(' | ')} |`)
    lines.push(`|${header.map(() => '---').join('|')}|`)
    for (const row of withMicros) {
      const byName = new Map(row.nutrients.map((n) => [n.name.toLowerCase(), n.amount]))
      const food = row.matched_food ? `${row.matched_food}${row.matched_source ? ` (${row.matched_source})` : ''}` : null
      const cells = columns.map((c) => {
        const amount = byName.get(c.name.toLowerCase())
        return amount == null ? '—' : String(Number(amount.toFixed(Math.abs(amount) >= 100 ? 0 : 2)))
      })
      lines.push(`| ${[mdCell(row.raw_text), mdCell(food), ...cells].join(' | ')} |`)
    }
  }

  return lines.join('\n') + '\n'
}

function buildReceiptText(result: EnrichedReceiptResponse, matches: Record<string, number>): string {
  const r = result.receipt
  const rows = exportRows(result, matches)
  const lines: string[] = ['RECEIPT SCAN', '']
  if (r) {
    lines.push(`Store: ${r.store ?? '-'}${r.location ? `, ${r.location}` : ''}`)
    lines.push(`Purchased: ${r.purchased_at ?? '-'}${r.timestamp_is_guess ? ' (guessed)' : ''}`)
    lines.push(`Total: ${r.total ?? '-'}${r.currency ? ` ${r.currency}` : ''}`, '')
  }
  for (const row of rows) {
    const cell = (v: number | null) => (v == null ? '-' : String(v))
    lines.push(`* ${row.raw_text.replace(/\s+/g, ' ').trim()}`)
    lines.push(`    matched: ${row.matched_food ?? '-'}${row.matched_source ? ` (${row.matched_source})` : ''}`)
    lines.push(`    per 100 g: energy ${cell(row.energy)} kcal, protein ${cell(row.protein)} g, fat ${cell(row.fat)} g, carbs ${cell(row.carbs)} g, fiber ${cell(row.fiber)} g`)
    for (const nutrient of row.nutrients) {
      lines.push(`    - ${formatNutrient(nutrient.name, nutrient.amount, nutrient.unit)}`)
    }
  }
  if (result.skipped.length) {
    lines.push('', 'SKIPPED')
    for (const s of result.skipped) lines.push(`* ${(s.raw_text || s.name).replace(/\s+/g, ' ').trim()} - ${s.reason.replace(/\s+/g, ' ').trim()}`)
  }
  return lines.join('\n') + '\n'
}

const EXPORT_FORMATS = {
  md: {label: '.MD', ext: 'md', mime: 'text/markdown;charset=utf-8', build: buildReceiptMarkdown},
  json: {label: 'JSON', ext: 'json', mime: 'application/json;charset=utf-8', build: buildReceiptJson},
  txt: {label: '.TXT', ext: 'txt', mime: 'text/plain;charset=utf-8', build: buildReceiptText},
  csv: {label: 'CSV', ext: 'csv', mime: 'text/csv;charset=utf-8', build: buildReceiptCsv},
} as const

type ExportFormat = keyof typeof EXPORT_FORMATS

export function ReceiptPage() {
  const { logout } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [imageOpen, setImageOpen] = useState(true)
  const [result, setResult] = useState<EnrichedReceiptResponse | null>(null)
  const [zoom, setZoom] = useState(1)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('md')
  // raw_text -> candidate index the user picked for that line
  const [matches, setMatches] = useState<Record<string, number>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    }
  }, [])

  // tick a clock while a scan is in flight so the progress bar shows real elapsed time
  useEffect(() => {
    if (!scanning) return
    const started = Date.now()
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 200)
    return () => clearInterval(timer)
  }, [scanning])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(timer)
  }, [notice])

  function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0]
    event.target.value = ''
    if (!chosen) return
    setError(null)
    setNotice(null)
    setResult(null)
    setMatches({})
    setZoom(1)
    setImageOpen(true)
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    const url = URL.createObjectURL(chosen)
    previewRef.current = url
    setFile(chosen)
    setPreview(url)
  }

  function changeZoom(delta: number) {
    setZoom((z) => Math.min(4, Math.max(0.5, Math.round((z + delta) * 4) / 4)))
  }

  async function onScan() {
    if (!file) return
    setScanning(true)
    setElapsed(0)
    setError(null)
    setNotice(null)
    try {
      const image = await prepareReceiptImage(file)
      const scanned = await scanReceiptNutrition(image)
      if (scanned) {
        setResult(scanned)
        setMatches({})
        setImageOpen(false)
        const count = scanned.items.length
        setNotice(`Scan complete — ${count} ${count === 1 ? 'item' : 'items'} recognized.`)
      }
      else setError('The scan returned no receipt data.')
    } catch (caught) {
      setResult(null)
      setError(caught instanceof ApiError ? caught.message : caught instanceof Error ? caught.message : 'Could not scan the receipt.')
    } finally {
      setScanning(false)
    }
  }

  const receipt = result?.receipt ?? null

  function onExport() {
    if (!result) return
    const format = EXPORT_FORMATS[exportFormat]
    const content = format.build(result, matches)
    const body = exportFormat === 'csv' ? ['\ufeff', content] : [content]
    const blob = new Blob(body, {type: format.mime})
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `receipt-${receipt?.store ?? 'scan'}-${stamp}.${format.ext}`.replace(/\s+/g, '-').toLowerCase()
    link.click()
    URL.revokeObjectURL(url)
  }

  const progressLabel = elapsed < 3
    ? 'Preparing the image…'
    : elapsed < 12
      ? 'Scanning the receipt…'
      : 'Matching items to the food database…'

  return (
    <main className="page wide">
      <header className="topbar">
        <div>
          <h1>Receipt (WIP)</h1>
          <GarminNav />
        </div>
        <button type="button" className="ghost" onClick={logout}>
          Log out
        </button>
      </header>

      <p className="lede">Upload a photo of a grocery receipt to scan the items and get their nutrition info on a micro level if available(NCCDB)<br></br><strong> (results may be inaccurate and for demo purposes this function is rate limited)</strong></p>
 {/* TODO proper rate limit and info */}

      <div className="card receipt-upload">
        <div className="receipt-actions">
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={scanning}>
            Upload receipt
          </button>
          <button type="button" onClick={onScan} disabled={!file || scanning}>
            {scanning ? 'Scanning…' : 'Scan receipt'}
          </button>
          {preview ? (
            <button type="button" className="ghost" onClick={() => setImageOpen((open) => !open)}>
              {imageOpen ? 'Hide image' : 'Show image'}
            </button>
          ) : null}
          {preview && imageOpen ? (
            <div className="receipt-preview-zoom-controls">
              <button type="button" className="ghost" onClick={() => changeZoom(-0.25)} disabled={zoom <= 0.5} aria-label="Zoom out">−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" className="ghost" onClick={() => changeZoom(0.25)} disabled={zoom >= 4} aria-label="Zoom in">+</button>
            </div>
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="receipt-file-input"
          accept="image/jpeg,image/png,image/webp"
          onChange={onFileSelected}
        />
        {preview ? (
          <div className="receipt-preview-wrap">
            {imageOpen ? (
              <div className="receipt-preview-scroll">
                <img className="receipt-preview" style={{maxHeight: `${60 * zoom}vh`}} src={preview} alt="Receipt preview" />
              </div>
            ) : null}
          </div>
        ) : <p className="empty">No receipt attached.</p>}
        {scanning ? (
          <div className="receipt-progress" role="status" aria-live="polite">
            <div className="receipt-progress-track">
              <div className="receipt-progress-fill" />
            </div>
            <p className="receipt-progress-label">
              {progressLabel}
              <span className="receipt-progress-elapsed">{elapsed.toFixed(1)}s</span>
            </p>
          </div>
        ) : null}
        {notice ? <p className="receipt-notice" role="status">{notice}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </div>

      {result ? (
        <>
          {receipt ? (
            <section className="card metrics">
              <p>
                <span>Store</span>
                <strong>{receipt.store}{receipt.location ? `, ${receipt.location}` : ''}</strong>
              </p>
              <p>
                <span>Purchased</span>
                <strong>
                  {formatDate(receipt.purchased_at)}
                  {receipt.timestamp_is_guess ? ' (guessed)' : ''}
                </strong>
              </p>
              <p>
                <span>Total</span>
                <strong>{formatAmount(receipt.total, receipt.currency)}</strong>
              </p>
              <p>
                <span>Items</span>
                <strong>
                  {result.items.length}
                  {result.skipped.length ? ` (+${result.skipped.length} skipped)` : ''}
                </strong>
              </p>
            </section>
          ) : null}

          <section className="card">
            <div className="receipt-section-head">
              <h2>Items</h2>
              {result.items.length ? (
                <div className="receipt-export">
                  <select
                    aria-label="Export format"
                    value={exportFormat}
                    onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
                  >
                    {(Object.keys(EXPORT_FORMATS) as ExportFormat[]).map((key) => (
                      <option key={key} value={key}>{EXPORT_FORMATS[key].label}</option>
                    ))}
                  </select>
                  <button type="button" className="ghost" onClick={onExport}>
                    Export
                  </button>
                </div>
              ) : null}
            </div>
            {result.items.length === 0 ? <p className="empty">No items were recognized.</p> : null}
            {result.items.map((item) => (
              <ReceiptItemCard
                key={item.raw_text}
                item={item}
                currency={receipt?.currency ?? null}
                pickedIndex={matches[item.raw_text] ?? 0}
                onPick={(index) => setMatches((current) => ({...current, [item.raw_text]: index}))}
              />
            ))}
            {result.skipped.length > 0 ? (
              <div className="receipt-skipped">
                <h3>Skipped</h3>
                <ul>
                  {result.skipped.map((entry) => (
                    <li key={entry.raw_text}>
                      {entry.raw_text || entry.name}
                      <span className="receipt-skip-reason"> {entry.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  )
}

function ReceiptItemCard({
  item,
  currency,
  pickedIndex,
  onPick,
}: {
  item: EnrichedReceiptItem
  currency: string | null
  pickedIndex: number
  onPick: (index: number) => void
}) {
  const candidate = item.candidates[pickedIndex]
  const nutrients = candidate?.nutrients ?? null
  const basis = nutrients?.basis?.weight_grams ?? 100
  // when the line carries a weight, show the item-scaled macros next to the 100 g values
  const factor = item.weight_grams != null ? item.weight_grams / basis : null
  const scale = (value: number | null) => value == null ? null : factor != null ? value * factor : null

  const meta: string[] = []
  if (item.quantity != null) meta.push(`× ${formatNumber(item.quantity, 0)}`)
  if (item.weight_grams != null) meta.push(`${formatNumber(item.weight_grams, 1)} g`)
  if (item.price != null) meta.push(formatAmount(item.price, currency))
  if (item.confidence != null) meta.push(`${Math.round(item.confidence * 100)}% match`)

  const macros = MACROS.map((macro) => {
    const entry = findMacro(nutrients, macro.name)
    const raw = entry ? entry.amount : null
    const unit = entry?.unit || macro.fallbackUnit
    const scaled = scale(entry ? entry.amount : null)
    return {
      label: macro.label,
      value: raw == null ? '—' : formatNumber(raw)
        + (unit ? ` ${unit}` : '')
        + (scaled != null ? ` / ${formatNumber(scaled)}${unit ? ` ${unit}` : ''}` : ''),
    }
  })

  return (
    <article className="receipt-item">
      <div className="receipt-item-head">
        <strong>{item.name}{item.brand ? ` (${item.brand})` : ''}</strong>
        <span className="receipt-item-raw">{item.raw_text}</span>
      </div>
      {meta.length ? <p className="receipt-item-meta">{meta.join(' · ')}</p> : null}

      {item.candidates.length === 0 ? (
        <p className="empty">No food match found for this line.</p>
      ) : (
        <>
          {item.candidates.length > 1 ? (
            <label className="receipt-item-select">
              Candidate
              <select
                value={String(pickedIndex)}
                onChange={(event) => onPick(Number(event.target.value))}
              >
                {item.candidates.map((entry, index) => (
                  <option key={entry.food_source_id ?? index} value={index}>
                    {entry.name}{entry.source ? ` (${entry.source})` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="receipt-item-meta">
              Matched: {candidate?.name}{candidate?.source ? ` (${candidate.source})` : ''}
            </p>
          )}
          <p className="receipt-macros">
            {macros.map((macro) => (
              <span key={macro.label}>{macro.label} {macro.value}</span>
            ))}
          </p>
          {nutrients && nutrients.nutrients.length > 0 ? (
            <details className="receipt-details">
              <summary>All nutrients ({nutrients.nutrient_count})</summary>
              <table className="receipt-nutrients">
                <thead>
                  <tr>
                    <th>Nutrient</th>
                    <th>Per 100 g</th>
                    {factor != null ? <th>For {formatNumber(item.weight_grams ?? 0, 1)} g</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {nutrients.nutrients.map((nutrient) => (
                    <tr key={nutrient.id}>
                      <td>{nutrient.name}</td>
                      <td>{formatNumber(nutrient.amount)}{nutrient.unit ? ` ${nutrient.unit}` : ''}</td>
                      {factor != null ? (
                        <td>
                          {scale(nutrient.amount) != null
                            ? `${formatNumber(scale(nutrient.amount) ?? 0)}${nutrient.unit ? ` ${nutrient.unit}` : ''}`
                            : '—'}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ) : null}
        </>
      )}
    </article>
  )
}
