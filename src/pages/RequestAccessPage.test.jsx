import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RequestAccessPage from './RequestAccessPage'

const Login = () => <div>login page</div>

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/request-access']}>
      <Routes>
        <Route path="/request-access" element={<RequestAccessPage />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </MemoryRouter>,
  )

describe('RequestAccessPage', () => {
  it('submits the form and shows the confirmation', async () => {
    renderPage()

    await userEvent.type(screen.getByLabelText(/^name$/i), 'Cynthia Sarr')
    await userEvent.type(
      screen.getByLabelText(/email/i),
      'cynthia@cofinacorp.com',
    )
    await userEvent.click(screen.getByRole('button', { name: /request access/i }))

    await screen.findByText('Request received')
    expect(
      screen.getByText(/we'll review your request/i),
    ).toBeInTheDocument()
  })

  it('surfaces the server error on rejection', async () => {
    renderPage()

    await userEvent.type(screen.getByLabelText(/^name$/i), 'Blocked Lead')
    await userEvent.type(
      screen.getByLabelText(/email/i),
      'taken@example.com',
    )
    await userEvent.click(screen.getByRole('button', { name: /request access/i }))

    await screen.findByText(/already under review/i)
    // stays on the form — no success panel, no navigation
    expect(screen.queryByText('Request received')).not.toBeInTheDocument()
  })

  it('links back to sign in', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /back to sign in/i }))
    expect(screen.getByText('login page')).toBeInTheDocument()
  })
})
