import { create } from 'zustand'
import { apiFetch } from '../api.js'

// Tag errors with the backend envelope's `code` so callers can map to
// user-facing messages (see src/errors.js).
const apiError = (data) => {
  const err = new Error(data?.error || 'Request failed')
  err.code = data?.code
  return err
}

export const ADMIN_PAGE_SIZE = 20

const useAdminStore = create((set, get) => ({
  users: [],
  usersTotal: 0,
  usersLoading: false,
  usersError: null,
  query: '',
  page: 1,
  activeAdminCount: 0,

  auditLogs: [],
  auditTotal: 0,
  auditLoading: false,
  auditError: null,

  grantableUsers: [],
  grantableUsersTotal: 0,
  grantableUsersLoading: false,
  grantableUsersError: null,
  grants: [],
  grantsLoading: false,
  grantsError: null,

  demoRequests: [],
  demoRequestsTotal: 0,
  demoRequestsLoading: false,
  demoRequestsError: null,

  reset: () =>
    set({
      users: [],
      usersTotal: 0,
      usersLoading: false,
      usersError: null,
      query: '',
      page: 1,
      activeAdminCount: 0,
      auditLogs: [],
      auditTotal: 0,
      auditLoading: false,
      auditError: null,
      grantableUsers: [],
      grantableUsersTotal: 0,
      grantableUsersLoading: false,
      grantableUsersError: null,
      grants: [],
      grantsLoading: false,
      grantsError: null,
      demoRequests: [],
      demoRequestsTotal: 0,
      demoRequestsLoading: false,
      demoRequestsError: null,
    }),

  // Members for datasource-grant pickers: role-filtered, with optional
  // server-side search. Falls back to client-side filtering via Select's
  // built-in search when no query is provided.
  fetchGrantableUsers: async (query = '') => {
    set({ grantableUsersLoading: true, grantableUsersError: null })
    try {
      const params = new URLSearchParams({ role: 'user', limit: '200' })
      if (query) params.set('q', query)
      const res = await apiFetch(`/admin/users?${params}`)
      const data = await res.json()
      if (!res.ok) throw apiError(data)
      set({ grantableUsers: data.items, grantableUsersTotal: data.total, grantableUsersLoading: false })
    } catch (err) {
      set({ grantableUsersError: err.message, grantableUsersLoading: false })
    }
  },

  fetchGrants: async (dsId) => {
    set({ grantsLoading: true, grantsError: null, grants: [] })
    try {
      const res = await apiFetch(`/admin/datasources/${dsId}/grants`)
      const data = await res.json()
      if (!res.ok) throw apiError(data)
      set({ grants: data, grantsLoading: false })
    } catch (err) {
      set({ grantsError: err.message, grantsLoading: false })
    }
  },

  grantDatasource: async (dsId, userId) => {
    try {
      const res = await apiFetch(`/admin/datasources/${dsId}/grants`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      })
      const data = await res.json()
      if (!res.ok) throw apiError(data)
      await get().fetchGrants(dsId)
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err.message, code: err.code }
    }
  },

  revokeGrant: async (grantId, dsId) => {
    try {
      const res = await apiFetch(`/admin/grants/${grantId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw apiError(data)
      }
      if (dsId) await get().fetchGrants(dsId)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message, code: err.code }
    }
  },

  fetchUsers: async (overrides = {}) => {
    const { query, page, signal } = { query: get().query, page: get().page, ...overrides }
    set({ usersLoading: true, usersError: null, query, page })
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      params.set('limit', String(ADMIN_PAGE_SIZE))
      params.set('offset', String((page - 1) * ADMIN_PAGE_SIZE))
      const res = await apiFetch(`/admin/users?${params}`, { signal })
      const data = await res.json()
      if (!res.ok) throw apiError(data)
      set({ users: data.items, usersTotal: data.total, activeAdminCount: data.active_admin_count ?? 0, usersLoading: false })
    } catch (err) {
      set({ usersError: err.message, usersLoading: false })
    }
  },

  inviteUser: async (payload) => {
    try {
      const res = await apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw apiError(data)
      await get().fetchUsers()
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err.message, code: err.code }
    }
  },

  regenerateInvite: async (userId) => {
    try {
      const res = await apiFetch(`/admin/users/${userId}/invite`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw apiError(data)
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err.message, code: err.code }
    }
  },

  cancelInvite: async (userId) => {
    try {
      const res = await apiFetch(`/admin/users/${userId}/invite`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw apiError(data)
      await get().fetchUsers()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message, code: err.code }
    }
  },

  updateUser: async (userId, payload) => {
    try {
      const res = await apiFetch(`/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        return { ok: false, error: data.error || `HTTP ${res.status}`, code: data.code }
      }
      await get().fetchUsers()
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err.message, code: err.code }
    }
  },

  revokeSessions: async (userId) => {
    try {
      const res = await apiFetch(`/admin/users/${userId}/revoke-sessions`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw apiError(data)
      await get().fetchUsers()
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err.message, code: err.code }
    }
  },

  fetchAuditLogs: async (filters = {}) => {
    set({ auditLoading: true, auditError: null })
    try {
      const params = new URLSearchParams()
      if (filters.action) params.set('action', filters.action)
      if (filters.resource_type) params.set('resource_type', filters.resource_type)
      if (filters.user_id) params.set('user_id', filters.user_id)
      params.set('limit', String(filters.limit ?? ADMIN_PAGE_SIZE))
      params.set('offset', String(filters.offset ?? 0))
      const res = await apiFetch(`/admin/audit-logs?${params}`)
      const data = await res.json()
      if (!res.ok) throw apiError(data)
      set({ auditLogs: data.items, auditTotal: data.total, auditLoading: false })
      return data
    } catch (err) {
      set({ auditError: err.message, auditLoading: false })
      return null
    }
  },

  fetchDemoRequests: async ({ status, limit = ADMIN_PAGE_SIZE, offset = 0 } = {}) => {
    set({ demoRequestsLoading: true, demoRequestsError: null })
    try {
      const params = new URLSearchParams({ request_type: 'demo' })
      if (status) params.set('status', status)
      params.set('limit', String(limit))
      params.set('offset', String(offset))
      const res = await apiFetch(`/admin/access-requests?${params}`)
      const data = await res.json()
      if (!res.ok) throw apiError(data)
      set({
        demoRequests: data.items,
        demoRequestsTotal: data.total,
        demoRequestsLoading: false,
      })
      return { ok: true, data }
    } catch (err) {
      set({ demoRequestsError: err.message, demoRequestsLoading: false })
      return { ok: false, error: err.message, code: err.code }
    }
  },

  approveDemoRequest: async (requestId) => {
    try {
      const res = await apiFetch(`/admin/access-requests/${requestId}/approve`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw apiError(data)
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err.message, code: err.code }
    }
  },

  dismissDemoRequest: async (requestId) => {
    try {
      const res = await apiFetch(`/admin/access-requests/${requestId}/dismiss`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw apiError(data)
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err.message, code: err.code }
    }
  },
}))

export default useAdminStore
