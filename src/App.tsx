import {Navigate, Route, Routes} from 'react-router-dom'
import {useAuth} from './auth/AuthProvider.tsx'
import {LoginPage} from './pages/LoginPage.tsx'
import {StressPage} from './pages/StressPage.tsx'
import type {ReactNode} from 'react'

function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
            path="/stress"
            element={
              <RequireAuth>
                <StressPage />
              </RequireAuth>
            }
        />
        <Route path="*" element={<Navigate to="/stress" replace />} />
      </Routes>
  )
}
