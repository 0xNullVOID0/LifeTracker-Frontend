export interface ReceiptPackageSize {
  value: number
  unit: 'g' | 'ml' | 'kg' | 'l' | 'piece'
}

export interface ReceiptScannedItem {
  rawText: string
  name: string
  brand?: string | null
  quantity: number
  packageSize?: ReceiptPackageSize | null
  weighedItem: boolean
  weightGrams?: number | null
  unitPrice?: number | null
  price?: number | null
  discount?: number | null
  promo?: string | null
  barcode?: string | null
  category: 'food' | 'beverage' | 'household' | 'other'
  confidence: number
  ambiguous: boolean
}

export interface ReceiptScannedReceipt {
  store: string
  location?: string | null
  purchasedAt: string
  timestampIsGuess: boolean
  currency: string
  receiptNo?: string | null
  subtotal?: number | null
  discounts?: number | null
  tax?: number | null
  total: number
  loyaltyIdPresent: boolean
  receiptCount: number
  items: ReceiptScannedItem[]
}
