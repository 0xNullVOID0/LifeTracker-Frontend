import {Navigate, Route, Routes} from 'react-router-dom'
import {useAuth} from './auth/AuthProvider.tsx'
import {BuienradarPage} from './pages/BuienradarPage.tsx'
import {ClimatePage} from './pages/ClimatePage.tsx'
import {DayPage} from './pages/DayPage.tsx'
import {HeartRatePage} from './pages/HeartRatePage.tsx'
import {InsideOutsidePage} from './pages/InsideOutsidePage.tsx'
import {LoginPage} from './pages/LoginPage.tsx'
import {SleepPage} from './pages/SleepPage.tsx'
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
            path="/day"
            element={
              <RequireAuth>
                <DayPage />
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
            path="/buienradar"
            element={
              <RequireAuth>
                <BuienradarPage />
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
        <Route path="*" element={<Navigate to="/day" replace />} />
      </Routes>
  )
}
