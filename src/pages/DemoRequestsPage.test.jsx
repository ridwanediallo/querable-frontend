import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import useAdminStore from '../stores/useAdminStore'
import DemoRequestsPage from './DemoRequestsPage'
import useAuthStore from '../stores/useAuthStore'
import { resetDemoRequestMocks } from '../test/mocks/handlers'

const mockRequest = {
  id: 'demo-1',
  request_type: 'demo',
  name: 'Ada Demo',
  email: 'ada@example.com',
  company: 'Ada Corp',
  use_case: 'Evaluate self-service reporting.',
  status: 'pending',
  created_at: '2026-09-01T00:00:00Z',
}

describe('DemoRequestsPage', () => {
  beforeEach(() => {
    resetDemoRequestMocks()
    useAdminStore.getState().reset()
    useAuthStore.setState({
      user: { id: 'u-admin', email: 'admin@example.com', role: 'admin' },
      isAuthenticated: true,
      loading: false,
      error: null,
    })
  })

  it('shows pending demo requests', async () => {
    render(<DemoRequestsPage />)

    expect(await screen.findByText('Ada Demo')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
  })

  it('can approve a request and show the generated invite', async () => {
    const user = userEvent.setup()
    render(<DemoRequestsPage />)
    await screen.findByText('Ada Demo')

    await user.click(screen.getByRole('button', { name: /approve/i }))

    expect(await screen.findByText(/share this one-time link/i)).toBeInTheDocument()
  })

  it('does not offer decision actions for non-pending requests', async () => {
    const user = userEvent.setup()
    render(<DemoRequestsPage />)
    await screen.findByText('Ada Demo')

    const segmented = screen.getByLabelText('segmented control')
    const approvedItem = segmented.querySelectorAll('.ant-segmented-item')[2]
    fireEvent.click(approvedItem)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    })
    expect(screen.getByText('No demo requests in this queue.')).toBeInTheDocument()
  })
})
