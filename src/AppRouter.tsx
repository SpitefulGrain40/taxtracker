import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { DashboardScreen } from './screens/DashboardScreen'
import { IncomeScreen } from './screens/IncomeScreen'
import { DocumentsScreen } from './screens/DocumentsScreen'
import { SharesScreen } from './screens/SharesScreen'
import { TaxReturnScreen } from './screens/TaxReturnScreen'
import { AccountScreen } from './screens/AccountScreen'

// Derive the router basename from the deployment base path so it always matches
// where the app is actually served (production /taxtracker/, staging
// /taxtracker-dev/, local /). Vite sets import.meta.env.BASE_URL to the `base`
// used at build time; strip the trailing slash React Router doesn't want.
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

interface Props {
  onLock: () => void
}

export function AppRouter({ onLock }: Props) {
  return (
    <BrowserRouter basename={BASENAME}>
      <AppShell onLock={onLock}>
        <Routes>
          <Route path="/" element={<DashboardScreen />} />
          <Route path="/income" element={<IncomeScreen />} />
          <Route path="/documents" element={<DocumentsScreen />} />
          <Route path="/shares" element={<SharesScreen />} />
          <Route path="/return" element={<TaxReturnScreen />} />
          <Route path="/account" element={<AccountScreen />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
