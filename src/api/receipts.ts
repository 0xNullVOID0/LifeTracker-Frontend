import {apiFetch} from './client.ts'
import type {EnrichedReceiptResponse} from '../types/receipt.ts'

// POST /api/cronometer/receipts/scan/nutrition: the .NET API runs the full
// pipeline (OpenRouter receipt scan, GWT food search, mobile nutrient lookup).
export function scanReceiptNutrition(file: File): Promise<EnrichedReceiptResponse | null> {
  const form = new FormData()
  form.append('photo', file)
  return apiFetch<EnrichedReceiptResponse>('/api/cronometer/receipts/scan/nutrition', { method: 'POST', body: form })
}
