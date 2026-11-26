import {Navigate, Route, Routes, useLocation} from 'react-router-dom'
import {useAuth} from './auth/AuthProvider.tsx'
import {loginHref} from './returnPath.ts'
import {HomePage} from './pages/HomePage.tsx'
import {WeatherPage} from './pages/WeatherPage.tsx'
import {ClimatePage} from './pages/ClimatePage.tsx'
import {HeartRatePage} from './pages/HeartRatePage.tsx'
import {InsideOutsidePage} from './pages/InsideOutsidePage.tsx'
import {LoginPage} from './pages/LoginPage.tsx'
import {ReceiptPage} from './pages/ReceiptPage.tsx'
import {SleepPage} from './pages/SleepPage.tsx'
import {StressPage} from './pages/StressPage.tsx'
import type {ReactNode} from 'react'

function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const location = useLocation()
  if (!token) return <Navigate to={loginHref(`${location.pathname}${location.search}`)} replace />
  return children
}

export default function App() {
  return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
            path="/home"
            element={
              <RequireAuth>
                <HomePage />
              </RequireAuth>
            }
        />
        <Route
            path="/stress"
            element={
              <RequireAuth>
                <StressPage />
              </RequireAuth>
            }
        />
        <Route
            path="/heartrate"
            element={
              <RequireAuth>
                <HeartRatePage />
              </RequireAuth>
            }
        />
        <Route
            path="/sleep"
            element={
              <RequireAuth>
                <SleepPage />
              </RequireAuth>
            }
        />
        <Route
            path="/climate"
            element={
              <RequireAuth>
                <ClimatePage />
              </RequireAuth>
            }
        />
        <Route
            path="/weather"
            element={
              <RequireAuth>
                <WeatherPage />
              </RequireAuth>
            }
        />
        <Route
            path="/inside-outside"
            element={
              <RequireAuth>
                <InsideOutsidePage />
              </RequireAuth>
            }
        />
        <Route
            path="/receipt"
            element={
              <RequireAuth>
                <ReceiptPage />
              </RequireAuth>
            }
        />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
  )
}
