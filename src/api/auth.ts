import {apiFetch} from './client.ts'

type TokenResponse = {
  token: string
}

export async function login(password: string): Promise<string> {
  const result = await apiFetch<TokenResponse>('/api/auth/token', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })

  if (!result?.token) {
    throw new Error('Login succeeded but no token was returned')
  }

  return result.token
}
