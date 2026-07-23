import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { MoreDrawer } from './MoreDrawer'

const props = {
  open: true, onClose: () => {}, onNavigate: vi.fn(), onSubmitFeedback: vi.fn(),
  onSwitchProfile: vi.fn(), onLock: vi.fn(), profileName: 'Mike',
}

describe('MoreDrawer', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<MoreDrawer {...props} open={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists Tax Return first, then account and actions', () => {
    render(<MoreDrawer {...props} />)
    expect(screen.getByRole('button', { name: /tax return/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /account & profile/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /price settings/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /lock/i })).toBeInTheDocument()
  })

  it('navigates to the account route', () => {
    render(<MoreDrawer {...props} />)
    screen.getByRole('button', { name: /account & profile/i }).click()
    expect(props.onNavigate).toHaveBeenCalledWith('/account')
  })

  it('navigates to the tax return route', () => {
    render(<MoreDrawer {...props} />)
    screen.getByRole('button', { name: /tax return/i }).click()
    expect(props.onNavigate).toHaveBeenCalledWith('/return')
  })

  it('triggers lock', () => {
    render(<MoreDrawer {...props} />)
    screen.getByRole('button', { name: /lock/i }).click()
    expect(props.onLock).toHaveBeenCalled()
  })
})
