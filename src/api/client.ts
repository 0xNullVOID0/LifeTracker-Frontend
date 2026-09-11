const TOKEN_KEY = 'lifetracker.token'

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

let onUnauthorized: (() => void) | undefined

export function setUnauthorizedHandler(handler: (() => void) | undefined) {
  onUnauthorized = handler
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

export function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_BASE ?? ''
  return `${base}${path}`
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    if (typeof record.error === 'string') return record.error
    if (typeof record.detail === 'string') return record.detail
    if (typeof record.title === 'string') return record.title
  }
  if (status === 401) return 'Unauthorized'
  if (status === 400) return 'Bad request'
  return `Request failed (${status})`
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(apiUrl(path), { ...init, headers })
  } catch {
    throw new ApiError(0, 'Cannot reach the API. Is LifeTracker running on http://127.0.0.1:5071?')
  }

  if (response.status === 204) return null

  const raw = await response.text()
  let body: unknown = null
  if (raw) {
    try {
      body = JSON.parse(raw) as unknown
    } catch {
      body = raw
    }
  }

  if (response.status === 401) {
    clearToken()
    onUnauthorized?.()
    throw new ApiError(401, errorMessage(401, body), body)
  }

  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(response.status, body), body)
  }

  return body as T
}
