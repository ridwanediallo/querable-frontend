import { create } from 'zustand'
import { message } from 'antd'
import { apiFetch, readNdjsonStream } from '../api.js'
import useDatasourceStore from './useDatasourceStore'
import useAuthStore from './useAuthStore'

const useQueryStore = create((set, get) => ({
  loading: false,
  error: null,

  // AbortController for the in-flight query — calling abort() cancels the
  // fetch and readNdjsonStream, preventing stale writes to state.
  _queryAbort: null,

  // The question whose submit last failed — Retry must resubmit THIS, not
  // the previous successful turn (a failed submit never creates a turn).
  // Persisted to sessionStorage so page reloads don't lose it.
  lastFailedQuestion: (() => {
    try { return sessionStorage.getItem('lastFailedQuestion') || null } catch { return null }
  })(),

  // Number of pipeline steps revealed so far during an in-flight query
  // (0..5). The backend streams a progress line as each step actually
  // completes: schema analyzed -> query written -> validated -> data
  // retrieved -> report composed.
  stepsDone: 0,

  conversationId: null,
  turns: [],

  // New-session starter suggestions for the selected datasource
  suggestions: [],
  suggestionsLoading: false,

  // Suggest-report: non-blocking async insight generation
  suggestStatus: 'idle', // 'idle' | 'processing' | 'ready'
  suggestReport: null,
  suggestSuggestions: [],
  _suggestPollTimer: null,
  _suggestDsId: null,
  // True after the first auto-trigger per login session. Persisted to
  // sessionStorage so page refreshes don't re-trigger LLM calls.
  _suggestAutoTriggered: (() => {
    try { return sessionStorage.getItem('suggestAutoTriggered') === '1' } catch { return false }
  })(),

  // Sidebar / history list
  conversations: [],
  conversationsLoading: false,

  submitQuery: async (question) => {
    // Rapid duplicate events can fire before React re-renders with the new
    // loading value. The live store state is authoritative here: once a
    // report is running, ignore further submits until it completes.
    if (get().loading) return

    const { conversationId, _queryAbort } = get()
    const { selectedDatasourceId } = useDatasourceStore.getState()

    // Cancel any in-flight query before starting a new one.
    if (_queryAbort) _queryAbort.abort()
    const controller = new AbortController()
    set({ loading: true, error: null, stepsDone: 0, _queryAbort: controller })

    try {
      const body = { question, conversation_id: conversationId }
      if (!conversationId && selectedDatasourceId) {
        body.data_source_id = selectedDatasourceId
      }
      const res = await apiFetch('/query', {
        method: 'POST',
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json()
        if (data.code === 'query_quota_exceeded') {
          const d = data.details || {}
          const limit = d.limit ?? 5
          useAuthStore.getState().setGuestQuota({
            limit,
            used: limit,
            remaining: d.remaining ?? 0,
          })
        }
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      const contentType = res.headers.get('content-type') || ''
      const data = contentType.includes('application/x-ndjson')
        ? await readNdjsonStream(res, (obj) => {
            if (obj.type === 'progress' && Number.isFinite(Number(obj.step))) {
              set((s) => ({ ...s, stepsDone: Math.max(s.stepsDone, Number(obj.step) + 1) }))
            }
          })
        : await res.json()

      if (data.error) {
        if (data.code === 'query_quota_exceeded') {
          const d = data.details || {}
          const limit = d.limit ?? 5
          useAuthStore.getState().setGuestQuota({
            limit,
            used: limit,
            remaining: d.remaining ?? 0,
          })
        }
        throw new Error(data.error || 'Query failed')
      }

      if (data.guest_quota) {
        useAuthStore.getState().setGuestQuota(data.guest_quota)
      }

      const newTurn = {
        id: data.turn_id,
        question,
        summary: data.summary,
        sql: data.sql,
        rows: data.rows,
        rowCount: data.row_count,
        chartSpec: data.chart_spec,
        kpis: data.kpis || null,
        executionTime: data.execution_time,
        noQuery: data.no_query || false,
        questionResolved: data.question_resolved || null,
        promptTokens: data.prompt_tokens || 0,
        completionTokens: data.completion_tokens || 0,
        totalTokens: data.total_tokens || 0,
      }

      const isNewConversation = !conversationId

      set((state) => ({
        conversationId: data.conversation_id,
        turns: [...state.turns, newTurn],
        loading: false,
        stepsDone: 0,
        lastFailedQuestion: null,
        _queryAbort: null,
      }))
      try { sessionStorage.removeItem('lastFailedQuestion') } catch {}

      // Refresh the recents list so a newly created session shows up
      if (isNewConversation) get().fetchConversations({ force: true })
    } catch (err) {
      // AbortError means the user started a new query — don't treat as failure.
      if (err.name === 'AbortError') return
      try { sessionStorage.setItem('lastFailedQuestion', question) } catch {}
      set({ error: err.message, loading: false, stepsDone: 0, lastFailedQuestion: question, _queryAbort: null })
    }
  },

  // Timestamp of last successful fetchConversations call (ms). Used to skip
  // redundant fetches when Sidebar and TopBar both trigger on mount/switch.
  _conversationsFetchedAt: 0,

  fetchConversations: async ({ signal, force = false } = {}) => {
    const { selectedDatasourceId } = useDatasourceStore.getState()
    if (!selectedDatasourceId) {
      set({ conversations: [], conversationsLoading: false })
      return
    }
    // Skip if fetched within the last 5 seconds (unless forced).
    const { _conversationsFetchedAt } = get()
    if (!force && Date.now() - _conversationsFetchedAt < 5000) return

    set({ conversationsLoading: true })
    try {
      const res = await apiFetch(
        `/conversations?data_source_id=${encodeURIComponent(selectedDatasourceId)}&per_page=100`,
        { signal }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const items = Array.isArray(data) ? data : data.items ?? []
      set({ conversations: items, conversationsLoading: false, _conversationsFetchedAt: Date.now() })
    } catch {
      set({ conversationsLoading: false })
    }
  },

  loadConversation: async (id, { signal } = {}) => {
    set({ loading: true, error: null })
    try {
      const res = await apiFetch(`/conversations/${id}`, { signal })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      const turns = data.turns.map((t) => ({
        id: t.id,
        question: t.question_raw,
        summary: t.summary,
        sql: t.generated_sql,
        rows: t.result_data || [],
        rowCount: t.result_row_count || 0,
        chartSpec: t.chart_spec,
        kpis: t.kpis || null,
        executionTime: t.execution_ms ? t.execution_ms / 1000 : null,
        noQuery: t.no_query,
        questionResolved: t.question_resolved || null,
      }))

      if (data.data_source_id) {
        useDatasourceStore.getState().selectDatasource(data.data_source_id)
      }

      set({
        conversationId: data.id,
        turns,
        loading: false,
      })
    } catch (err) {
      set({
        error: err.message,
        loading: false,
        conversationId: null,
        turns: [],
      })
    }
  },

  deleteConversation: async (id) => {
    try {
      const res = await apiFetch(`/conversations/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        ...(state.conversationId === id
          ? { conversationId: null, turns: [] }
          : {}),
      }))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  },

  newConversation: () => {
    const { _suggestPollTimer } = get()
    if (_suggestPollTimer) clearTimeout(_suggestPollTimer)
    set({
      conversationId: null,
      turns: [],
      error: null,
      stepsDone: 0,
      suggestStatus: 'idle',
      suggestReport: null,
      suggestSuggestions: [],
      _suggestPollTimer: null,
    })
  },

  reset: () => {
    const { _queryAbort, _suggestPollTimer } = get()
    if (_queryAbort) _queryAbort.abort()
    if (_suggestPollTimer) clearTimeout(_suggestPollTimer)
    try {
      sessionStorage.removeItem('lastFailedQuestion')
      // NOTE: Do NOT clear 'suggestAutoTriggered' here — the guard must
      // survive logout so the auto-trigger doesn't re-fire when the user
      // is redirected to '/' after sign-out.
      // Clear all suggestApplied:* keys
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i)
        if (key && key.startsWith('suggestApplied:')) sessionStorage.removeItem(key)
      }
    } catch {}
    set({
      loading: false,
      error: null,
      lastFailedQuestion: null,
      conversationId: null,
      turns: [],
      suggestions: [],
      suggestionsLoading: false,
      suggestStatus: 'idle',
      suggestReport: null,
      suggestSuggestions: [],
      _suggestPollTimer: null,
      _suggestDsId: null,
      // NOTE: Do NOT reset _suggestAutoTriggered — it persists via
      // sessionStorage and prevents re-triggering after logout.
      conversations: [],
      conversationsLoading: false,
      _conversationsFetchedAt: 0,
      stepsDone: 0,
      _queryAbort: null,
    })
  },

  fetchSuggestions: async (dsId) => {
    if (!dsId) {
      set({ suggestions: [], suggestionsLoading: false })
      return
    }
    set({ suggestionsLoading: true })
    try {
      const res = await apiFetch(`/datasources/${dsId}/suggestions`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      set({ suggestions: data.suggestions || [], suggestionsLoading: false })
    } catch {
      set({ suggestions: [], suggestionsLoading: false })
    }
  },

  // --- Suggest Report (async two-step) ---

  // Poll the status endpoint with exponential backoff: 3s, then x1.5 per
  // poll, capped at 10s — long generations don't hammer the endpoint
  // (review item #12). Self-scheduling via setTimeout; the timer id is
  // stored in _suggestPollTimer so cancel/reset can clearTimeout it.
  // Hard stop after 30 attempts (~4 min) so a lost cache entry (e.g. backend
  // restart) can never leave the spinner spinning forever.
  _startSuggestPolling: (dsId) => {
    const { _suggestPollTimer } = get()
    if (_suggestPollTimer) clearTimeout(_suggestPollTimer)
    let attempts = 0
    const tick = (delay) => {
      const timer = setTimeout(async () => {
        await get().pollSuggestStatus(dsId)
        attempts += 1
        if (get().suggestStatus === 'processing') {
          if (attempts >= 30) {
            set({ suggestStatus: 'idle' })
            message.error('Insight discovery is taking too long. Please try again.')
            return
          }
          tick(Math.min(Math.round(delay * 1.5), 10000))
        }
      }, delay)
      set({ _suggestPollTimer: timer })
    }
    tick(3000)
  },

  startSuggestReport: async (dsId) => {
    if (!dsId) return
    const { suggestStatus, _suggestPollTimer } = get()
    if (suggestStatus === 'processing') return

    // Clear any existing poll timer
    if (_suggestPollTimer) clearTimeout(_suggestPollTimer)

    set({ suggestStatus: 'processing', suggestReport: null, suggestSuggestions: [], _suggestDsId: dsId })
    try {
      const res = await apiFetch(`/datasources/${dsId}/suggest-report`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      if (data.status === 'ready') {
        // Already done (cached)
        set({ suggestStatus: 'ready', suggestReport: data.report, suggestSuggestions: data.suggestions || [] })
        return
      }
      // Start polling
      get()._startSuggestPolling(dsId)
    } catch (err) {
      set({ suggestStatus: 'idle' })
      message.error(err?.message || 'Could not start insight discovery.')
    }
  },

  pollSuggestStatus: async (dsId) => {
    try {
      const res = await apiFetch(`/datasources/${dsId}/suggest-report/status`)
      const data = await res.json()
      if (data.status === 'ready') {
        set({
          suggestStatus: 'ready',
          suggestReport: data.report,
          suggestSuggestions: data.suggestions || [],
        })
      } else if (data.status === 'error') {
        set({ suggestStatus: 'idle' })
        const detail = data.error || 'Insight discovery failed.'
        message.error(`Insight discovery failed. ${detail}`)
      }
      // 'processing' → the poller keeps going with backoff
    } catch {
      // Network error — stop polling
      set({ suggestStatus: 'idle' })
    }
  },

  applySuggestedReport: () => {
    const { suggestReport, suggestSuggestions, _suggestDsId } = get()
    if (!suggestReport) return

    // Mark this datasource's suggestion as applied so checkSuggestStatus
    // won't re-show the button after page reload.
    if (_suggestDsId) {
      try { sessionStorage.setItem(`suggestApplied:${_suggestDsId}`, '1') } catch {}
    }

    const newTurn = {
      id: suggestReport.turn_id,
      question: suggestReport.question,
      summary: suggestReport.summary,
      sql: suggestReport.sql,
      rows: suggestReport.rows,
      rowCount: suggestReport.row_count,
      chartSpec: suggestReport.chart_spec,
      kpis: suggestReport.kpis || null,
      executionTime: suggestReport.execution_time,
      noQuery: suggestReport.no_query || false,
      questionResolved: null,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    }

    set((state) => ({
      conversationId: suggestReport.conversation_id,
      turns: [...state.turns, newTurn],
      suggestions: suggestSuggestions,
      suggestStatus: 'idle',
      suggestReport: null,
      suggestSuggestions: [],
    }))

    get().fetchConversations({ force: true })
  },

  cancelSuggestReport: () => {
    const { _suggestPollTimer } = get()
    if (_suggestPollTimer) clearTimeout(_suggestPollTimer)
    set({ suggestStatus: 'idle', _suggestPollTimer: null })
  },

  // Called on page mount to resume an in-progress suggest-report after reload.
  // Checks the backend status and either resumes polling or loads the result.
  checkSuggestStatus: async (dsId) => {
    if (!dsId) return
    const { suggestStatus } = get()
    // Already tracking — don't interfere
    if (suggestStatus === 'processing' || suggestStatus === 'ready') return

    // User already applied this datasource's suggestion — don't re-show button
    try {
      if (sessionStorage.getItem(`suggestApplied:${dsId}`) === '1') return
    } catch {}

    try {
      const res = await apiFetch(`/datasources/${dsId}/suggest-report/status`)
      const data = await res.json()
      if (data.status === 'processing') {
        set({ suggestStatus: 'processing', _suggestDsId: dsId })
        get()._startSuggestPolling(dsId)
      } else if (data.status === 'ready') {
        set({
          suggestStatus: 'ready',
          suggestReport: data.report,
          suggestSuggestions: data.suggestions || [],
          _suggestDsId: dsId,
        })
      }
      // 'idle' or no entry → do nothing
    } catch {
      // Network error — ignore, user can click manually
    }
  },
}))

export default useQueryStore
