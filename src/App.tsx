import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { PinScreen } from './screens/PinScreen'
import { SetupScreen } from './screens/SetupScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { IncomeScreen } from './screens/IncomeScreen'
import { DocumentsScreen } from './screens/DocumentsScreen'
import { SharesScreen } from './screens/SharesScreen'
import { TaxReturnScreen } from './screens/TaxReturnScreen'
import { useAuth } from './hooks/useAuth'
import { storage } from './lib/storage'
import { useState } from 'react'

export function App() {
  const { unlocked, error, attemptUnlock } = useAuth()
  const [setupDone, setSetupDone] = useState(() => storage.isSetupComplete())
  const [onboardingDone, setOnboardingDone] = useState(() =>
    storage.isOnboardingComplete(storage.getActiveProfile())
  )

  if (!setupDone) {
    return <SetupScreen onComplete={() => setSetupDone(true)} />
  }

  if (!unlocked) {
    return <PinScreen onUnlock={attemptUnlock} error={error} />
  }

  if (!onboardingDone) {
    return (
      <OnboardingScreen onComplete={() => {
        storage.setOnboardingComplete(storage.getActiveProfile())
        setOnboardingDone(true)
      }} />
    )
  }

  return (
    <BrowserRouter basename="/taxtracker">
      <AppShell onProfileSwitch={() => {}}>
        <Routes>
          <Route path="/" element={<DashboardScreen />} />
          <Route path="/income" element={<IncomeScreen />} />
          <Route path="/documents" element={<DocumentsScreen />} />
          <Route path="/shares" element={<SharesScreen />} />
          <Route path="/return" element={<TaxReturnScreen />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
