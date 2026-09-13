import {ApiError, getToken} from './client.ts'

const TOKEN_KEY = 'lifetracker.azure.token'

export function getAzureToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY) ?? (import.meta.env.PROD ? getToken() : null)
}

export function setAzureToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearAzureToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

function azureUrl(path: string): string {
  const base = import.meta.env.VITE_AZURE_API ?? (import.meta.env.DEV ? '/azure-api' : '')
  return `${base}${path}`
}

export async function azureFetch<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getAzureToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(azureUrl(path), { ...init, headers })
  } catch {
    throw new ApiError(0, 'Cannot reach the Azure API')
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
    clearAzureToken()
    throw new ApiError(401, 'Unauthorized', body)
  }

  if (!response.ok) {
    throw new ApiError(response.status, `Azure request failed (${response.status})`, body)
  }

  return body as T
}

export async function azureLogin(password: string): Promise<string> {
  const result = await azureFetch<{ token: string }>('/api/auth/token', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
  if (!result?.token) throw new Error('Azure login succeeded but no token was returned')
  setAzureToken(result.token)
  return result.token
}
