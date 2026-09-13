import { beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../test/mocks/server'
import useQueryStore from './useQueryStore'
import useDatasourceStore from './useDatasourceStore'

const resetStore = () => {
  useQueryStore.setState({
    loading: false,
    error: null,
    conversationId: null,
    turns: [],
    conversations: [],
    conversationsLoading: false,
    _conversationsFetchedAt: 0,
    stepsDone: 0,
  })
}

const setDatasource = (id) => useDatasourceStore.getState().selectDatasource(id)

describe('useQueryStore', () => {
  beforeEach(() => {
    resetStore()
    useDatasourceStore.setState({ selectedDatasourceId: null })
  })

  describe('submitQuery', () => {
    it('creates a turn and sets conversation id', async () => {
      await useQueryStore.getState().submitQuery('How many customers?')

      const state = useQueryStore.getState()
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.conversationId).toBe('conv-1')
      expect(state.turns).toHaveLength(1)
      expect(state.turns[0]).toMatchObject({
        question: 'How many customers?',
        rowCount: 2,
        sql: expect.stringContaining('SELECT'),
      })
    })

    it('appends to existing turns on follow-up', async () => {
      await useQueryStore.getState().submitQuery('first')
      await useQueryStore.getState().submitQuery('second')

      const state = useQueryStore.getState()
      expect(state.turns).toHaveLength(2)
      expect(state.turns[0].question).toBe('first')
      expect(state.turns[1].question).toBe('second')
    })

    it('sends data_source_id when no conversation exists', async () => {
      let capturedBody = null
      server.use(
        http.post('/api/v1/query', async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({
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
          })
        }),
      )
      setDatasource('ds-2')
      await useQueryStore.getState().submitQuery('question')

      expect(capturedBody).toMatchObject({
        question: 'question',
        conversation_id: null,
        data_source_id: 'ds-2',
      })
    })

    it('does not send data_source_id for follow-ups in a conversation', async () => {
      let capturedBody = null
      server.use(
        http.post('/api/v1/query', async ({ request }) => {
          capturedBody = await request.json()
          return HttpResponse.json({
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
          })
        }),
      )
      useQueryStore.setState({ conversationId: 'conv-1' })
      await useQueryStore.getState().submitQuery('follow-up')

      expect(capturedBody).toMatchObject({
        question: 'follow-up',
        conversation_id: 'conv-1',
      })
      expect('data_source_id' in capturedBody).toBe(false)
    })

    it('sets error on failure', async () => {
      server.use(
        http.post('/api/v1/query', () =>
          HttpResponse.json({ error: 'LLM exploded' }, { status: 500 }),
        ),
      )
      await useQueryStore.getState().submitQuery('boom')

      const state = useQueryStore.getState()
      expect(state.error).toBe('LLM exploded')
      expect(state.loading).toBe(false)
    })

    it('remembers the failed question so Retry can resubmit it', async () => {
      server.use(
        http.post('/api/v1/query', () =>
          HttpResponse.json({ error: 'LLM exploded' }, { status: 500 }),
        ),
      )
      await useQueryStore.getState().submitQuery('the question that failed')
      expect(useQueryStore.getState().lastFailedQuestion).toBe(
        'the question that failed',
      )

      // A subsequent successful submit clears it.
      server.use(
        http.post('/api/v1/query', () =>
          HttpResponse.json({
            summary: 'Answered: ok',
            sql: 'SELECT 1',
            rows: [],
            row_count: 0,
            no_query: false,
            conversation_id: 'conv-1',
            turn_id: 'turn-2',
          }),
        ),
      )
      await useQueryStore.getState().submitQuery('a good question')
      expect(useQueryStore.getState().lastFailedQuestion).toBeNull()
    })

    it('advances stepsDone as progress lines stream in', async () => {
      server.use(
        http.post('/api/v1/query', () => {
          const stream = new ReadableStream({
            start(controller) {
              for (let step = 0; step < 5; step += 1) {
                controller.enqueue(
                  new TextEncoder().encode(`${JSON.stringify({ type: 'progress', step })}\n`),
                )
              }
              controller.enqueue(
                new TextEncoder().encode(
                  `${JSON.stringify({
                    type: 'result',
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
                  })}\n`,
                ),
              )
              controller.close()
            },
          })
          return new HttpResponse(stream, {
            headers: { 'Content-Type': 'application/x-ndjson' },
          })
        }),
      )

      const seen = []
      useQueryStore.subscribe((s) => seen.push(s.stepsDone))
      const promise = useQueryStore.getState().submitQuery('question')
      await promise

      const state = useQueryStore.getState()
      expect(state.loading).toBe(false)
      expect(state.turns).toHaveLength(1)
      // Each step was revealed before the final reset to 0 after completion.
      expect(seen).toContain(1)
      expect(seen).toContain(5)
      expect(state.stepsDone).toBe(0)
    })

    it('surfaces a streamed error line as an error', async () => {
      server.use(
        http.post('/api/v1/query', () =>
          HttpResponse.text(
            [
              JSON.stringify({ type: 'progress', step: 0 }),
              JSON.stringify({ type: 'error', error: 'Datasource is down', code: 'query_failed', request_id: 'abc' }),
            ].join('\n'),
            { headers: { 'Content-Type': 'application/x-ndjson' } },
          ),
        ),
      )
      await useQueryStore.getState().submitQuery('question')

      const state = useQueryStore.getState()
      expect(state.error).toBe('Datasource is down')
      expect(state.loading).toBe(false)
      expect(state.stepsDone).toBe(0)
    })

    it('ignores a duplicate submit while the first query is in flight', async () => {
      let requestCount = 0
      let releaseQuery = () => {}
      server.use(
        http.post('/api/v1/query', () => {
          requestCount += 1
          return new Promise((resolve) => {
            releaseQuery = (payload) => resolve(HttpResponse.json(payload))
          })
        }),
      )

      const firstQuery = useQueryStore.getState().submitQuery('first')
      await vi.waitFor(() => expect(requestCount).toBe(1))
      const duplicateQuery = useQueryStore.getState().submitQuery('second')

      expect(requestCount).toBe(1)
      expect(useQueryStore.getState().loading).toBe(true)
      await expect(duplicateQuery).resolves.toBeUndefined()

      releaseQuery({
        summary: 'ok',
        chart_spec: null,
        kpis: null,
        sql: 'SELECT 1',
        rows: [],
        row_count: 0,
        execution_time: 0.1,
        no_query: false,
        conversation_id: 'conv-1',
        turn_id: 'turn-1',
      })
      await firstQuery

      expect(requestCount).toBe(1)
      expect(useQueryStore.getState().loading).toBe(false)
    })
  })

  describe('fetchConversations', () => {
    it('loads conversations for the selected datasource', async () => {
      setDatasource('ds-1')
      await useQueryStore.getState().fetchConversations()
      const { conversations } = useQueryStore.getState()
      expect(conversations).toHaveLength(1)
      expect(conversations[0].title).toBe('How many students are in each major?')
    })

    it('filters by the selected datasource', async () => {
      setDatasource('ds-2')
      await useQueryStore.getState().fetchConversations()
      const { conversations } = useQueryStore.getState()
      expect(conversations).toHaveLength(1)
      expect(conversations[0].data_source_id).toBe('ds-2')
      expect(conversations[0].title).toBe('Top products by region')
    })

    it('returns an empty list when no datasource is selected', async () => {
      await useQueryStore.getState().fetchConversations()
      expect(useQueryStore.getState().conversations).toHaveLength(0)
    })
  })

  describe('loadConversation', () => {
    it('maps turns from the server shape', async () => {
      await useQueryStore.getState().loadConversation('conv-1')

      const state = useQueryStore.getState()
      expect(state.conversationId).toBe('conv-1')
      expect(state.turns).toHaveLength(2)
      expect(state.turns[0].question).toBe('How many students are in each major?')
      expect(state.turns[0].rowCount).toBe(5)
      expect(state.turns[1].questionResolved).toBe(
        'What is the department with the most students?',
      )
    })

    it('syncs the selected datasource to the conversation', async () => {
      setDatasource('ds-2')
      await useQueryStore.getState().loadConversation('conv-1')

      expect(useDatasourceStore.getState().selectedDatasourceId).toBe('ds-1')
    })

    it('clears the thread and records the error when loading fails', async () => {
      server.use(
        http.get('/api/v1/conversations/:id', () =>
          HttpResponse.json(
            { error: 'Conversation not found', code: 'conversation_not_found' },
            { status: 404 },
          ),
        ),
      )
      useQueryStore.setState({ conversationId: 'conv-1', turns: [{ id: 'x' }] })

      await useQueryStore.getState().loadConversation('conv-1')

      const state = useQueryStore.getState()
      expect(state.error).toBe('Conversation not found')
      expect(state.loading).toBe(false)
      expect(state.conversationId).toBeNull()
      expect(state.turns).toHaveLength(0)
    })
  })

  describe('deleteConversation', () => {
    it('removes conversation from the list and clears if active', async () => {
      useQueryStore.setState({ conversationId: 'conv-1', turns: [{ id: 'x' }] })
      await useQueryStore.getState().fetchConversations()

      const result = await useQueryStore.getState().deleteConversation('conv-1')

      expect(result.ok).toBe(true)
      const state = useQueryStore.getState()
      expect(state.conversations).toHaveLength(0)
      expect(state.conversationId).toBeNull()
      expect(state.turns).toHaveLength(0)
    })
  })

  describe('newConversation', () => {
    it('resets conversation state', () => {
      useQueryStore.setState({ conversationId: 'conv-1', turns: [{ id: 'x' }] })
      useQueryStore.getState().newConversation()
      expect(useQueryStore.getState().conversationId).toBeNull()
      expect(useQueryStore.getState().turns).toHaveLength(0)
    })
  })

  describe('reset', () => {
    it('clears all session state for a new identity', () => {
      useQueryStore.setState({
        loading: true,
        error: 'stale',
        conversationId: 'conv-1',
        turns: [{ id: 'x' }],
        suggestions: ['s'],
        suggestionsLoading: true,
        conversations: [{ id: 'conv-1' }],
        conversationsLoading: true,
      })

      useQueryStore.getState().reset()

      const state = useQueryStore.getState()
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.conversationId).toBeNull()
      expect(state.turns).toHaveLength(0)
      expect(state.suggestions).toHaveLength(0)
      expect(state.suggestionsLoading).toBe(false)
      expect(state.conversations).toHaveLength(0)
      expect(state.conversationsLoading).toBe(false)
    })
  })
})
