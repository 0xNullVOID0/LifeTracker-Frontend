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

  const progressLabel = elapsed < 3
    ? 'Preparing the image…'
    : elapsed < 12
      ? 'Scanning the receipt…'
      : 'Matching items to the food database…'

  return (
    <main className="page wide">
      <header className="topbar">
        <div>
          <h1>Receipt</h1>
          <GarminNav />
        </div>
        <button type="button" className="ghost" onClick={logout}>
          Log out
        </button>
      </header>

      <p className="lede">Upload a photo of a grocery receipt to scan the items and get their nutrition info</p>
      <p className="lede">For demo purposes this function is rate limited</p>
 {/* TODO proper rate limit and info */}

      <div className="card receipt-upload">
        <div className="receipt-actions">
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={scanning}>
            Upload receipt
          </button>
          <button type="button" onClick={onScan} disabled={!file || scanning}>
            {scanning ? 'Scanning…' : 'Scan receipt'}
          </button>
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
            <div className="receipt-preview-zoom">
              <button type="button" className="ghost" onClick={() => setImageOpen((open) => !open)}>
                {imageOpen ? 'Hide image' : 'Show image'}
              </button>
              {imageOpen ? (
                <div className="receipt-preview-zoom-controls">
                  <button type="button" className="ghost" onClick={() => changeZoom(-0.25)} disabled={zoom <= 0.5} aria-label="Zoom out">−</button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button type="button" className="ghost" onClick={() => changeZoom(0.25)} disabled={zoom >= 4} aria-label="Zoom in">+</button>
                </div>
              ) : null}
            </div>
            {imageOpen ? (
              <div className="receipt-preview-scroll">
                <img className="receipt-preview" style={{transform: `scale(${zoom})`}} src={preview} alt="Receipt preview" />
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
            <h2>Items</h2>
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
