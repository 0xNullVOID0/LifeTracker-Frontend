type Slot<T> = {
  has: boolean
  value: T
  updatedAt: number
  version: number
  inflight: Promise<T> | null
}

type Cooldown = {
  clicks: number
  until: number
}

const slots = new Map<string, Slot<unknown>>()
const slices = new Map<string, { source: object; value: unknown }>()
const chartMemo = new WeakMap<object, WeakMap<object, unknown>>()
const chartOne = new WeakMap<object, unknown>()
const cooldowns = new Map<string, Cooldown>()
const cooldownListeners = new Set<() => void>()

export const cacheKeys = {
  roomClimate: (date: string) => `room-climate:${date}`,
  buienradar: 'buienradar',
  garminDays: 'garmin-days',
  activity: (date: string) => `activity:${date}`,
  heart: (date: string) => `heartrate:${date}`,
  sleep: (date: string) => `sleep:${date}`,
  stress: (date: string) => `stress:${date}`,
  garminDay: (date: string) => `garmin-day:${date}`,
  awake: (date: string) => `awake:${date}`,
}

export const refreshScopes = {
  sensors: 'sensors',
  home: 'home',
  garmin: 'garmin',
} as const

function ensure<T>(key: string): Slot<T> {
  let slot = slots.get(key) as Slot<T> | undefined
  if (!slot) {
    slot = { has: false, value: undefined as T, updatedAt: 0, version: 0, inflight: null }
    slots.set(key, slot as Slot<unknown>)
  }
  return slot
}

export function hasCache(key: string): boolean {
  return slots.get(key)?.has === true
}

export function readCache<T>(key: string): { value: T } | undefined {
  const slot = slots.get(key) as Slot<T> | undefined
  if (!slot?.has) return undefined
  return { value: slot.value }
}

export function writeCache<T>(key: string, value: T) {
  const slot = ensure<T>(key)
  if (slot.inflight) return
  slot.has = true
  slot.value = value
  slot.updatedAt = Date.now()
}

export function dropCache(key: string) {
  slots.delete(key)
}

export async function loadCache<T>(
  key: string,
  load: () => Promise<T>,
  opts: { force?: boolean; maxAge?: number } = {},
): Promise<T> {
  const slot = ensure<T>(key)
  const fresh = slot.has && opts.maxAge != null && Date.now() - slot.updatedAt < opts.maxAge
  if (!opts.force && fresh) return slot.value
  if (!opts.force && slot.inflight) return slot.inflight

  const version = ++slot.version
  const promise = load()
    .then((value) => {
      if (slot.version === version) {
        slot.has = true
        slot.value = value
        slot.updatedAt = Date.now()
      }
      return value
    })
    .finally(() => {
      if (slot.inflight === promise) slot.inflight = null
    })
  slot.inflight = promise
  return promise
}

export function cachedSlice<T>(source: object, key: string, compute: () => T): T {
  const hit = slices.get(key)
  if (hit && hit.source === source) return hit.value as T
  const value = compute()
  slices.set(key, { source, value })
  return value
}

export function memoOne<T extends object, R>(source: T, compute: () => R): R {
  if (chartOne.has(source)) return chartOne.get(source) as R
  const value = compute()
  chartOne.set(source, value)
  return value
}

export function memoTwo<A extends object, B extends object, R>(a: A, b: B, compute: () => R): R {
  let inner = chartMemo.get(a)
  if (!inner) {
    inner = new WeakMap()
    chartMemo.set(a, inner)
  }
  if (inner.has(b)) return inner.get(b) as R
  const value = compute()
  inner.set(b, value)
  return value
}

export function manualCooldownLeft(scope: string): number {
  const row = cooldowns.get(scope)
  if (!row) return 0
  return Math.max(0, row.until - Date.now())
}

export function noteManualRefresh(scope: string) {
  const row = cooldowns.get(scope) ?? { clicks: 0, until: 0 }
  row.clicks += 1
  if (row.clicks <= 1) row.until = Date.now()
  else if (row.clicks === 2) row.until = Date.now() + 60_000
  else row.until = Date.now() + 5 * 60_000
  cooldowns.set(scope, row)
  cooldownListeners.forEach((listener) => listener())
}

export function subscribeManualCooldown(listener: () => void): () => void {
  cooldownListeners.add(listener)
  return () => cooldownListeners.delete(listener)
}

export function formatCooldown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
