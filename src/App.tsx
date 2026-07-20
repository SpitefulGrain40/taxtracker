import { PinScreen } from './screens/PinScreen'
import { SetupScreen } from './screens/SetupScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { AppRouter } from './AppRouter'
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

  return <AppRouter />
}
