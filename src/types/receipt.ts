// Wire shape of POST /api/cronometer/receipts/scan/nutrition.
// Mirrors LifeTracker/DTOs/Cronometer/CronometerDTOs.cs; the .NET API serializes
// these DTOs with the snake_case [JsonPropertyName] attributes, so fields stay snake_case.

export interface ReceiptPackageSize {
  value: number | null
  unit: string | null
}

export interface ReceiptNutrient {
  id: number
  name: string
  amount: number
  unit: string
  category: string | null
}

// the mobile get_food_nutrients() response, per 100 g basis
export interface FoodNutrients {
  status: string
  food: { food_source_id: number; name: string; source: string } | null
  basis: { weight_grams: number; note: string } | null
  nutrient_count: number
  nutrients: ReceiptNutrient[]
}

export interface ReceiptFoodCandidate {
  food_id: number | null
  food_source_id: number | null
  name: string
  measure_desc: string
  score: number
  source: string
  type: string
  query: string | null
  nutrients: FoodNutrients | null
}

export interface EnrichedReceiptItem {
  raw_text: string
  name: string
  brand: string | null
  quantity: number | null
  category: string | null
  confidence: number | null
  package_size: ReceiptPackageSize | null
  weight_grams: number | null
  price: number | null
  candidates: ReceiptFoodCandidate[]
}

export interface SkippedReceiptItem {
  raw_text: string
  name: string
  reason: string
}

export interface EnrichedReceiptInfo {
  store: string
  location: string | null
  purchased_at: string | null
  currency: string | null
  receipt_no: string | null
  subtotal: number | null
  discounts: number | null
  tax: number | null
  total: number | null
  loyalty_id_present: boolean | null
  receipt_count: number | null
  timestamp_is_guess: boolean | null
}

export interface EnrichedReceiptResponse {
  receipt: EnrichedReceiptInfo | null
  items: EnrichedReceiptItem[]
  skipped: SkippedReceiptItem[]
  scan_meta: Record<string, unknown> | null
}
