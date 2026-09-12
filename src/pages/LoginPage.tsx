import {type FormEvent, useState} from 'react'
import {Navigate, useNavigate} from 'react-router-dom'
import {ApiError} from '../api/client.ts'
import {useAuth} from '../auth/AuthProvider.tsx'

export function LoginPage() {
  const { token, login } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (token) return <Navigate to="/day" replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      await login(password)
      navigate('/day', { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        setError('Wrong password')
      } else if (caught instanceof Error) {
        setError(caught.message)
      } else {
        setError('Login failed')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="page">
      <h1>LifeTracker</h1>
      <p className="lede">Sign in with the API password (Compose / Development: demo).</p>
      <form className="card" onSubmit={onSubmit}>
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
