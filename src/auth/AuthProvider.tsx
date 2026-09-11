import {createContext, type ReactNode, useContext, useEffect, useMemo, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {login as requestToken} from '../api/auth.ts'
import {clearToken, getToken, setToken, setUnauthorizedHandler} from '../api/client.ts'

type AuthContextValue = {
  token: string | null
  login: (password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [token, setTokenState] = useState<string | null>(() => getToken())

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setTokenState(null)
      navigate('/login', { replace: true })
    })
    return () => setUnauthorizedHandler(undefined)
  }, [navigate])

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      async login(password: string) {
        const next = await requestToken(password)
        setToken(next)
        setTokenState(next)
      },
      logout() {
        clearToken()
        setTokenState(null)
        navigate('/login', { replace: true })
      },
    }),
    [navigate, token],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Context files export the hook next to the provider; Fast Refresh still applies to AuthProvider.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
