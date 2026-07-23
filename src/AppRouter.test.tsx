import { render, screen } from '@testing-library/react'
import { AppRouter } from './AppRouter'

// Regression: after onboarding the app mounts the router. On staging the site is
// served from a base path (e.g. /taxtracker-dev/) that differs from production
// (/taxtracker/). If the router's basename is hardcoded and doesn't match the
// path the app is actually served from, React Router matches no route and
// renders nothing — the reported "black screen after onboarding". The router
// must derive its basename from the deployment base (import.meta.env.BASE_URL),
// which under test is '/', so the dashboard route must resolve at pathname '/'.
describe('AppRouter', () => {
  it('renders the dashboard route at the served base path (no black screen)', () => {
    render(<AppRouter onLock={() => {}} />)
    // With no PAT configured the dashboard shows its loading state — its
    // presence proves the route matched rather than rendering a blank page.
    expect(screen.getByText(/Loading your tax position/i)).toBeInTheDocument()
  })
})
