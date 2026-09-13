import { describe, expect, it, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../test/mocks/server'
import QueryPage from './QueryPage'
import useQueryStore from '../stores/useQueryStore'
import useDatasourceStore from '../stores/useDatasourceStore'
import useAuthStore from '../stores/useAuthStore'

// ChartSpec renders an antv/G2 canvas, which jsdom cannot rasterize.
vi.mock('../components/features/ChartSpec', () => ({ default: () => null }))

const renderPage = () =>
  render(
    <MemoryRouter>
      <QueryPage />
    </MemoryRouter>,
  )

describe('QueryPage new-session suggestions', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = function () {}
    useQueryStore.setState({
      conversationId: null,
      turns: [],
      suggestions: [],
      suggestionsLoading: false,
      error: null,
      loading: false,
    })
    useDatasourceStore.setState({
      datasources: [],
      selectedDatasourceId: 'ds-1',
      currentDatasource: null,
    })
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      guestQuota: null,
      loading: false,
      error: null,
    })
  })

  it('shows schema-derived starter suggestions in the empty state', async () => {
    renderPage()
    expect(await screen.findByText('Try one of these:')).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: /How many students are in each major/i }),
    ).toBeInTheDocument()
  })

  it('submits the question when a suggestion chip is clicked', async () => {
    renderPage()
    const chip = await screen.findByRole('button', {
      name: /How many students are in each major/i,
    })
    await userEvent.click(chip)
    expect(
      await screen.findByText('Answered: How many students are in each major?'),
    ).toBeInTheDocument()
  })

  it('shows the empty state without suggestions', async () => {
    server.use(
      http.get('/api/v1/datasources/ds-1/suggestions', () =>
        HttpResponse.json({ suggestions: [] }),
      ),
    )
    renderPage()
    expect(screen.getByText(/Ask your data anything/i)).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText('Try one of these:')).toBeNull()
  })

  it('hides starter suggestions once a turn is present', async () => {
    renderPage()
    await screen.findByRole('button', { name: /How many students/i })
    await userEvent.click(
      screen.getAllByRole('button', { name: /How many students/i }).slice(-1)[0],
    )
    await screen.findByText(/Answered:/)
    expect(screen.queryByText('Try one of these:')).toBeNull()
  })
})

describe('QueryPage guest quota', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = function () {}
    useQueryStore.setState({
      conversationId: null,
      turns: [],
      suggestions: [],
      suggestionsLoading: false,
      error: null,
      loading: false,
    })
    useDatasourceStore.setState({
      datasources: [],
      selectedDatasourceId: 'ds-1',
      currentDatasource: null,
    })
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      guestQuota: null,
      loading: false,
      error: null,
    })
  })

  it('shows the guest quota badge and remaining count after a query', async () => {
    server.use(
      http.post('/api/v1/query', () =>
        HttpResponse.json({
          summary: 'ok',
          chart_spec: null,
          kpis: null,
          sql: 'SELECT 1',
          rows: [],
          row_count: 0,
          execution_time: 0.1,
          no_query: false,
          conversation_id: 'conv-1',
          turn_id: 't1',
          guest_quota: { limit: 5, used: 1, remaining: 4 },
        }),
      ),
    )
    renderPage()
    const input = screen.getByPlaceholderText('Ask a question about your data')
    await userEvent.type(input, 'how many customers?')
    await userEvent.click(screen.getByTitle('Send'))

    expect(await screen.findByText(/4 guest queries remaining/i)).toBeInTheDocument()
    expect(screen.getByText(/Guest 1\/5/)).toBeInTheDocument()
  })

  it('locks the composer and offers sign-in when the quota is exhausted', async () => {
    useAuthStore.setState({
      guestQuota: { limit: 5, used: 5, remaining: 0 },
    })
    renderPage()

    expect(
      await screen.findByText('Guest query limit reached.'),
    ).toBeInTheDocument()
    const input = screen.getByPlaceholderText(
      'Guest limit reached — sign in to keep querying',
    )
    expect(input).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /sign in to keep querying/i }),
    ).toBeInTheDocument()
  })

  it('locks the composer when the server rejects with query_quota_exceeded', async () => {
    server.use(
      http.post('/api/v1/query', () =>
        HttpResponse.json(
          {
            error: 'Guest query limit reached. Sign in to keep querying.',
            code: 'query_quota_exceeded',
            details: { limit: 5, remaining: 0 },
          },
          { status: 429 },
        ),
      ),
    )
    renderPage()

    const input = screen.getByPlaceholderText('Ask a question about your data')
    await userEvent.type(input, 'one too many?')
    await userEvent.click(screen.getByTitle('Send'))

    await waitFor(() => {
      expect(useAuthStore.getState().guestQuota).toEqual({
        limit: 5,
        used: 5,
        remaining: 0,
      })
    })
    expect(
      await screen.findByText('Guest query limit reached.'),
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('Guest limit reached — sign in to keep querying'),
    ).toBeDisabled()
  })

  it('does not show a quota banner to signed-in users', async () => {
    useAuthStore.setState({
      user: { id: 'u-1', email: 'a@b.c', name: 'A', role: 'user' },
      isAuthenticated: true,
    })
    renderPage()
    expect(screen.queryByText(/Guest 1\/5/)).toBeNull()
  })
})

describe('QueryPage loading skeleton', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = function () {}
    useQueryStore.setState({
      conversationId: null,
      turns: [],
      suggestions: [],
      suggestionsLoading: false,
      error: null,
      loading: true,
    })
    useDatasourceStore.setState({
      datasources: [],
      selectedDatasourceId: 'ds-1',
      currentDatasource: null,
    })
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      guestQuota: null,
      loading: false,
      error: null,
    })
  })

  it('shows a loading report panel with pipeline steps while a query runs', () => {
    renderPage()
    expect(screen.getByLabelText('Loading report')).toBeInTheDocument()
    expect(screen.getByText('Schema analyzed')).toBeInTheDocument()
    expect(screen.getByText('Report composed')).toBeInTheDocument()
    expect(document.querySelector('.skeleton-chart')).toBeInTheDocument()
    expect(screen.getByText(/Working on your report/)).toBeInTheDocument()
  })

  it('marks a pipeline step as complete when the stream reports it', () => {
    useQueryStore.setState({ stepsDone: 2 })
    renderPage()
    const chips = document.querySelectorAll('.pipeline-chip')
    expect(chips.length).toBe(5)
    expect(chips[0].textContent).toContain('Schema analyzed')
    expect(chips[0].className).not.toContain('pending')
    expect(chips[1].className).not.toContain('pending')
    expect(chips[2].className).not.toContain('pending')
    expect(chips[3].className).toContain('pending')
  })
})

describe('QueryPage retry after failure', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = function () {}
    useQueryStore.setState({
      conversationId: 'conv-1',
      turns: [
        {
          id: 'turn-1',
          question: 'the previous successful question',
          summary: 'Answered: the previous successful question',
          sql: 'SELECT 1',
          rows: [{ n: 1 }],
          rowCount: 1,
          chartSpec: null,
          kpis: null,
          executionTime: 0.1,
          noQuery: false,
          questionResolved: null,
        },
      ],
      suggestions: [],
      suggestionsLoading: false,
      error: 'The server is busy processing other queries.',
      loading: false,
      lastFailedQuestion: 'the question that failed',
    })
    useDatasourceStore.setState({
      datasources: [],
      selectedDatasourceId: 'ds-1',
      currentDatasource: null,
    })
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      guestQuota: { limit: 5, used: 2, remaining: 3 },
      loading: false,
      error: null,
    })
  })

  it('resubmits the failed question, not the previous turn', async () => {
    const submitSpy = vi.fn()
    const real = useQueryStore.getState().submitQuery
    useQueryStore.setState({ submitQuery: submitSpy })

    try {
      renderPage()
      await userEvent.click(screen.getByRole('button', { name: /retry/i }))
      expect(submitSpy).toHaveBeenCalledWith('the question that failed')
      expect(submitSpy).not.toHaveBeenCalledWith('the previous successful question')
    } finally {
      useQueryStore.setState({ submitQuery: real })
    }
  })

  it('falls back to the last turn when nothing failed', async () => {
    useQueryStore.setState({ lastFailedQuestion: null })
    const submitSpy = vi.fn()
    const real = useQueryStore.getState().submitQuery
    useQueryStore.setState({ submitQuery: submitSpy })

    try {
      renderPage()
      await userEvent.click(screen.getByRole('button', { name: /retry/i }))
      expect(submitSpy).toHaveBeenCalledWith('the previous successful question')
    } finally {
      useQueryStore.setState({ submitQuery: real })
    }
  })
})

describe('QueryPage empty query results', () => {
  it('shows an explicit no-data message instead of pretending the SQL is an answer', () => {
    useQueryStore.setState({
      conversationId: 'conv-1',
      turns: [
        {
          id: 'turn-1',
          question: 'What is the monthly revenue trend?',
          sql: 'SELECT 1',
          rows: [],
          rowCount: 0,
          summary: null,
          chartSpec: null,
          kpis: null,
          executionTime: 0.1,
          noQuery: false,
        },
      ],
    })
    useDatasourceStore.setState({
      datasources: [],
      selectedDatasourceId: 'ds-1',
      currentDatasource: null,
    })
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      guestQuota: null,
      loading: false,
      error: null,
    })

    try {
      renderPage()
      expect(
        screen.getByText('No matching rows in this data source', {
          selector: '.ant-alert-title',
        })
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'The query completed successfully, but it did not return any rows for the selected period or filters. You can review the SQL below or try a broader date range.',
          { selector: '.ant-alert-description' }
        )
      ).toBeInTheDocument()
    } finally {
      useQueryStore.getState().reset()
      useDatasourceStore.getState().reset()
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        guestQuota: null,
        loading: true,
        error: null,
      })
    }
  })
})

describe('QueryPage duplicate submissions', () => {
  it('ignores a duplicate key event while the live query is in flight', async () => {
    const submitSpy = vi.fn(() => {
      useQueryStore.setState({ loading: true })
      return Promise.resolve()
    })
    const realSubmit = useQueryStore.getState().submitQuery

    useQueryStore.setState({
      conversationId: 'conv-1',
      turns: [
        {
          id: 'turn-1',
          question: 'the previous question',
          summary: 'Answered',
          sql: 'SELECT 1',
          rows: [{ n: 1 }],
          rowCount: 1,
          noQuery: false,
        },
      ],
      loading: false,
      suggestStatus: 'ready',
      submitQuery: submitSpy,
    })
    useDatasourceStore.setState({
      datasources: [],
      selectedDatasourceId: 'ds-1',
      currentDatasource: null,
    })
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      guestQuota: null,
      loading: false,
      error: null,
    })

    try {
      renderPage()
      const input = screen.getByPlaceholderText('Ask a follow-up question')
      await userEvent.type(input, 'the duplicate question')
      fireEvent.keyDown(input, { key: 'Enter' })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(submitSpy).toHaveBeenCalledTimes(1)
      expect(submitSpy).toHaveBeenCalledWith('the duplicate question')
    } finally {
      useQueryStore.setState({ submitQuery: realSubmit, loading: false })
    }
  })
})
