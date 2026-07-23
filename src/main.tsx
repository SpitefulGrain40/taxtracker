import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { applyDevSeedFromUrl } from './lib/devSeed'

// Dev-only: honour ?seed / ?seed=off before the app reads any auth/data state.
// No-op in staging/production builds.
applyDevSeedFromUrl()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
