import {type ChangeEvent, useEffect, useRef, useState} from 'react'
import {scanReceiptPhoto} from '../api/receipts.ts'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'
import {prepareReceiptImage} from '../receiptImage.ts'
import type {ReceiptScannedItem, ReceiptScannedReceipt} from '../types/receipt.ts'
import {GarminNav} from './NavBar.tsx'

function formatAmount(value: number | null | undefined, currency: string): string {
  if (value == null) return '—'
  return `${value.toFixed(2)} ${currency}`
}

export function ReceiptPage() {
  const { logout } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<ReceiptScannedReceipt | null>(null)
  const [zoom, setZoom] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    }
  }, [])

  function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0]
    event.target.value = ''
    if (!chosen) return
    setError(null)
    setReceipt(null)
    setZoom(1)
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
    setError(null)
    try {
      const image = await prepareReceiptImage(file)
      const scanned = await scanReceiptPhoto(image)
      if (scanned) setReceipt(scanned)
      else setError('The scan returned no receipt data.')
    } catch (caught) {
      setReceipt(null)
      setError(caught instanceof ApiError ? caught.message : caught instanceof Error ? caught.message : 'Could not scan the receipt.')
    } finally {
      setScanning(false)
    }
  }

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

      <p className="lede">Upload a photo of a receipt to scan the items and get their nutrition info</p>
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
              <button type="button" className="ghost" onClick={() => changeZoom(-0.25)} disabled={zoom <= 0.5} aria-label="Zoom out">−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" className="ghost" onClick={() => changeZoom(0.25)} disabled={zoom >= 4} aria-label="Zoom in">+</button>
            </div>
            <div className="receipt-preview-scroll">
              <img className="receipt-preview" style={{width: `${zoom * 100}%`}} src={preview} alt="Receipt preview" />
            </div>
          </div>
        ) : <p className="empty">No receipt attached.</p>}
        {error ? <p className="error">{error}</p> : null}
      </div>

      {receipt ? (
        <>
          <section className="card metrics">
            <p>
              <span>Store</span>
              <strong>{receipt.store}{receipt.location ? `, ${receipt.location}` : ''}</strong>
            </p>
            <p>
              <span>Purchased</span>
              <strong>
                {new Date(receipt.purchasedAt).toLocaleString(undefined, { hour12: false })}
                {receipt.timestampIsGuess ? ' (guessed)' : ''}
              </strong>
            </p>
            <p>
              <span>Total</span>
              <strong>{formatAmount(receipt.total, receipt.currency)}</strong>
            </p>
            <p>
              <span>Items</span>
              <strong>{receipt.items.length}</strong>
            </p>
          </section>

          <section className="card samples">
            <h2>Items</h2>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Weight</th>
                  <th>Category</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item) => (
                  <ReceiptItemRow key={item.rawText} item={item} currency={receipt.currency} />
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </main>
  )
}

function ReceiptItemRow({item, currency}: {item: ReceiptScannedItem; currency: string}) {
  const weight = item.weightGrams != null ? `${item.weightGrams} g` : '—'
  const price = item.price != null ? formatAmount(item.price, currency) : '—'
  return (
    <tr>
      <td>{item.name}{item.ambiguous ? ' (uncertain)' : ''}</td>
      <td>{item.quantity}</td>
      <td>{weight}</td>
      <td>{item.category}</td>
      <td>{price}</td>
    </tr>
  )
}
