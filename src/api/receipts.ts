import {apiFetch} from './client.ts'
import type {ReceiptScannedReceipt} from '../types/receipt.ts'

// fails with a 404 till route is properly implemented
export function scanReceiptPhoto(file: File): Promise<ReceiptScannedReceipt | null> {
  const form = new FormData()
  form.append('photo', file)
  return apiFetch<ReceiptScannedReceipt>('/api/receipts/scan', { method: 'POST', body: form })
}
