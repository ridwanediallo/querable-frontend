import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DemoRequestFunnel from './DemoRequestModal'
import useAuthStore from '../../stores/useAuthStore'
import * as api from '../../api'

vi.mock('../../api', async (importOriginal) => {
  const orig = await importOriginal()
  return {
    ...orig,
    apiFetch: vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'Request received. We\'ll review it and get back to you.' }),
    }),
  }
})

const setGuestState = ({ user = null, guestQuota = { limit: 5, used: 1, remaining: 4 } } = {}) => {
  useAuthStore.setState({
    user,
    isAuthenticated: Boolean(user),
    guestQuota,
    loading: false,
  })
}

beforeEach(() => {
  sessionStorage.clear()
  setGuestState()
})

afterEach(() => {
  sessionStorage.clear()
})

describe('guest demo request funnel', () => {
  it('shows the floating CTA only for guests', () => {
    render(<DemoRequestFunnel isGuest />)
    expect(screen.getByRole('button', { name: /request a demo/i })).toBeInTheDocument()
  })

  it('is hidden for signed-in users', () => {
    setGuestState({ user: { id: 'u-user' }, guestQuota: null })
    render(<DemoRequestFunnel isGuest={false} />)
    expect(screen.queryByRole('button', { name: /request a demo/i })).toBeNull()
  })

  it('submits the lead and shows confirmation', async () => {
    const user = userEvent.setup()
    render(<DemoRequestFunnel isGuest />)

    await user.click(screen.getByRole('button', { name: /request a demo/i }))
    await user.type(await screen.findByLabelText('Name'), 'Cynthia Sarr')
    await user.type(screen.getByLabelText('Work email'), 'cynthia@example.com')
    await user.type(screen.getByLabelText('Company'), 'Cofina')
    await user.type(screen.getByLabelText('What would you like to see?'), 'Customer revenue trends')
    await user.click(screen.getByRole('button', { name: /request demo/i }))

    expect(
      await screen.findByRole('heading', { name: /request received/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/thanks for your interest/i)).toBeInTheDocument()
  })

  it('does not dismiss the CTA when the modal is closed without submitting', async () => {
    const user = userEvent.setup()
    render(<DemoRequestFunnel isGuest />)

    await user.click(screen.getByRole('button', { name: /request a demo/i }))
    const modal = await screen.findByRole('dialog')
    await user.click(modal.querySelector('.ant-modal-close'))

    expect(sessionStorage.getItem('querable-demo-cta-dismissed')).toBeNull()
  })
})
