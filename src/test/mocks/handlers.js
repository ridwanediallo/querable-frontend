import { http, HttpResponse } from 'msw'

const adminUser = {
  id: 'u-admin',
  email: 'admin@queryable.local',
  name: 'Admin',
  role: 'admin',
  is_active: true,
  created_at: '2026-07-01T00:00:00Z',
  last_login_at: '2026-08-01T00:00:00Z',
  turn_count: 12,
  total_tokens: 4800,
}

const regularUser = {
  id: 'u-user',
  email: 'user@queryable.local',
  name: 'User',
  role: 'user',
  is_active: true,
  created_at: '2026-07-01T00:00:00Z',
  last_login_at: null,
  turn_count: 5,
  total_tokens: 2000,
}

const regularUser2 = {
  id: 'u-user-2',
  email: 'user2@queryable.local',
  name: 'Second User',
  role: 'user',
  is_active: true,
  created_at: '2026-07-02T00:00:00Z',
  last_login_at: null,
  turn_count: 0,
  total_tokens: 0,
}

const datasources = [
  {
    id: 'ds-1',
    name: 'school',
    db_type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database_name: 'school',
    username: 'data_retriever',
    status: 'ready',
    is_sample: false,
    description: '',
    schema_table_count: 5,
    created_at: '2026-07-30T00:00:00Z',
    updated_at: '2026-07-30T00:00:00Z',
  },
  {
    id: 'ds-2',
    name: 'Customers & Orders',
    db_type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database_name: 'sample_target',
    username: 'data_retriever',
    status: 'ready',
    is_sample: true,
    description: '',
    schema_table_count: 2,
    created_at: '2026-07-30T00:00:00Z',
    updated_at: '2026-07-30T00:00:00Z',
  },
]

const conversations = [
  {
    id: 'conv-1',
    data_source_id: 'ds-1',
    title: 'How many students are in each major?',
    created_at: '2026-07-30T00:00:00Z',
    updated_at: '2026-07-30T00:00:00Z',
    turn_count: 2,
  },
  {
    id: 'conv-2',
    data_source_id: 'ds-2',
    title: 'Top products by region',
    created_at: '2026-07-31T00:00:00Z',
    updated_at: '2026-07-31T00:00:00Z',
    turn_count: 1,
  },
]

const buildDemoRequests = () => [
  {
    id: 'demo-1',
    request_type: 'demo',
    name: 'Ada Demo',
    email: 'ada@example.com',
    company: 'Ada Corp',
    use_case: 'Evaluate self-service reporting for our delivery data.',
    status: 'pending',
    created_at: '2026-09-01T00:00:00Z',
    decided_at: null,
    decided_by: null,
    created_user_id: null,
  },
]

let demoRequests = buildDemoRequests()

export function resetDemoRequestMocks() {
  demoRequests = buildDemoRequests()
}

const turns = [
  {
    id: 'turn-1',
    conversation_id: 'conv-1',
    sequence: 1,
    question_raw: 'How many students are in each major?',
    question_resolved: null,
    generated_sql: 'SELECT major, COUNT(*) AS n FROM students GROUP BY major',
    result_columns: [['major', 'n']],
    result_row_count: 5,
    result_data: [
      { major: 'CS', n: 8 },
      { major: 'EE', n: 5 },
      { major: 'ME', n: 4 },
      { major: 'CE', n: 2 },
      { major: 'Math', n: 1 },
    ],
    summary: 'Computer Science is the most popular major with 8 students.',
    chart_spec: { type: 'bar', title: 'Students by major', x: 'major', y: 'n' },
    kpis: [{ label: 'TOP MAJOR', value: 'CS', trend: 'flat' }],
    no_query: false,
    status: 'completed',
    execution_ms: 1234,
    created_at: '2026-07-30T00:00:00Z',
  },
  {
    id: 'turn-2',
    conversation_id: 'conv-1',
    sequence: 2,
    question_raw: 'And the largest department?',
    question_resolved: 'What is the department with the most students?',
    generated_sql: 'SELECT d.name, COUNT(e.id) AS n FROM departments d LEFT JOIN courses c ON c.department_id = d.id LEFT JOIN enrollments e ON e.course_id = c.id GROUP BY d.name ORDER BY n DESC LIMIT 1',
    result_columns: [['name', 'n']],
    result_row_count: 1,
    result_data: [{ name: 'Engineering', n: 12 }],
    summary: 'Engineering is the largest department.',
    chart_spec: null,
    kpis: [{ label: 'LARGEST DEPT', value: 'Engineering', trend: 'flat' }],
    no_query: false,
    status: 'completed',
    execution_ms: 987,
    created_at: '2026-07-30T00:00:00Z',
  },
]

const queryResponse = (question) => ({
  summary: `Answered: ${question}`,
  chart_spec: { type: 'bar', title: 'Results', x: 'name', y: 'count' },
  kpis: [{ label: 'TOTAL', value: '5', trend: 'flat' }],
  sql: 'SELECT name, COUNT(*) AS count FROM customers GROUP BY name LIMIT 1000',
  rows: [
    { name: 'North', count: 3 },
    { name: 'South', count: 2 },
  ],
  row_count: 2,
  execution_time: 0.42,
  no_query: false,
  question_resolved: null,
  conversation_id: 'conv-1',
  turn_id: 'turn-99',
  guest_quota: { limit: 5, used: 1, remaining: 4 },
})

const accessRequestsState = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Cynthia Sarr',
      email: 'cynthia@cofinacorp.com',
      company: 'Cofina',
      use_case: 'Automated lending reports',
      status: 'pending',
      created_at: '2026-09-07T09:00:00+00:00',
      decided_at: null,
      decided_by: null,
      created_user_id: null,
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Approved Lead',
      email: 'approved@example.com',
      company: null,
      use_case: null,
      status: 'approved',
      created_at: '2026-09-06T09:00:00+00:00',
      decided_at: '2026-09-06T10:00:00+00:00',
      decided_by: '99999999-9999-4999-8999-999999999999',
      created_user_id: '88888888-8888-4888-8888-888888888888',
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Dismissed Lead',
      email: 'dismissed@example.com',
      company: null,
      use_case: null,
      status: 'dismissed',
      created_at: '2026-09-05T09:00:00+00:00',
      decided_at: '2026-09-05T10:00:00+00:00',
      decided_by: '99999999-9999-4999-8999-999999999999',
      created_user_id: null,
    },
]

export const handlers = [
  http.get('/api/v1/auth/csrf', () =>
    HttpResponse.json({ csrf_token: 'test-csrf-token' }),
  ),
  http.get('/api/v1/auth/me', () =>
    HttpResponse.json({ is_authenticated: true, user: adminUser }),
  ),
  http.post('/api/v1/auth/login', async ({ request }) => {
    const body = await request.json()
    if (!body.email || !body.password) {
      return HttpResponse.json(
        { error: 'Email and password are required', code: 'missing_credentials' },
        { status: 400 },
      )
    }
    if (body.password === 'wrong') {
      return HttpResponse.json(
        { error: 'Invalid email or password', code: 'invalid_credentials' },
        { status: 401 },
      )
    }
    return HttpResponse.json({ user: regularUser })
  }),
  http.post('/api/v1/auth/logout', () => HttpResponse.json({ ok: true })),
  http.post('/api/v1/auth/claim-guest', () => HttpResponse.json({ migrated: 0 })),
  http.post('/api/v1/auth/forgot-password', async () => {
    return HttpResponse.json({ message: 'If an account exists, a reset link has been sent.', token: 'test-reset-token' })
  }),
  http.post('/api/v1/auth/reset-password', async ({ request }) => {
    const body = await request.json()
    if (!body.token || !body.new_password) {
      return HttpResponse.json({ error: 'Token and new password are required', code: 'missing_fields' }, { status: 400 })
    }
    return HttpResponse.json({ message: 'Password has been reset. Please sign in.' })
  }),
  http.post('/api/v1/auth/request-demo', async ({ request }) => {
    const body = await request.json()
    if (!body.name || !body.email) {
      return HttpResponse.json({ error: 'Name is required', code: 'missing_fields' }, { status: 400 })
    }
    return HttpResponse.json({ message: 'Request received. We’ll review it and get back to you.' })
  }),

  http.get('/api/v1/admin/access-requests', ({ request }) => {
    const url = new URL(request.url)
    const requestType = url.searchParams.get('request_type') || 'access'
    const status = url.searchParams.get('status')
    const limit = Number(url.searchParams.get('limit') || 50)
    const offset = Number(url.searchParams.get('offset') || 0)
    const items = demoRequests
      .filter((req) => req.request_type === requestType)
      .filter((req) => !status || req.status === status)
      .slice(offset, offset + limit)
    return HttpResponse.json({ total: demoRequests.length, limit, offset, items })
  }),

  http.post('/api/v1/admin/access-requests/:id/approve', ({ params }) => {
    const item = demoRequests.find((req) => req.id === params.id)
    if (!item) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    if (item.status !== 'pending') {
      return HttpResponse.json(
        { error: 'This request was already decided', code: 'already_decided' },
        { status: 409 },
      )
    }
    item.status = 'approved'
    return HttpResponse.json({
      user: { id: 'u-user-3', email: item.email },
      sample_granted: true,
    })
  }),

  http.post('/api/v1/admin/access-requests/:id/dismiss', ({ params }) => {
    const item = demoRequests.find((req) => req.id === params.id)
    if (!item) return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    if (item.status !== 'pending') {
      return HttpResponse.json(
        { error: 'This request was already decided', code: 'already_decided' },
        { status: 409 },
      )
    }
    item.status = 'dismissed'
    return HttpResponse.json(item)
  }),

  http.get('/api/v1/admin/users', ({ request }) => {
    const url = new URL(request.url)
    const role = url.searchParams.get('role')
    const items =
      role === 'user' ? [regularUser, regularUser2] : [adminUser, regularUser, regularUser2]
    const activeAdminCount = items.filter((u) => u.role === 'admin' && u.status === 'active').length
    return HttpResponse.json({ total: items.length, items, active_admin_count: activeAdminCount })
  }),

  http.get('/api/v1/admin/datasources/:id/grants', () =>
    HttpResponse.json([
      {
        id: 'grant-1',
        user_id: 'u-user',
        data_source_id: 'ds-1',
        granted_by: 'u-admin',
        created_at: '2026-08-01T00:00:00Z',
      },
    ]),
  ),
  http.post('/api/v1/admin/datasources/:id/grants', async ({ request }) => {
    const body = await request.json()
    if (!body.user_id) {
      return HttpResponse.json(
        { error: 'user_id is required', code: 'missing_fields' },
        { status: 400 },
      )
    }
    return HttpResponse.json(
      {
        id: 'grant-new',
        user_id: body.user_id,
        data_source_id: 'ds-1',
        granted_by: 'u-admin',
        created_at: '2026-08-20T00:00:00Z',
      },
      { status: 201 },
    )
  }),
  http.delete('/api/v1/admin/grants/:id', () => HttpResponse.json({ ok: true })),

  http.get('/api/v1/datasources', () => HttpResponse.json(datasources)),
  http.post('/api/v1/datasources', () =>
    HttpResponse.json(
      { ...datasources[0], id: 'ds-new', name: 'new-ds' },
      { status: 201 },
    ),
  ),
  http.get('/api/v1/datasources/:id', ({ params }) => {
    const ds = datasources.find((d) => d.id === params.id)
    return ds ? HttpResponse.json(ds) : HttpResponse.json({ error: 'Not found' }, { status: 404 })
  }),
  http.delete('/api/v1/datasources/:id', () =>
    HttpResponse.json({ ok: true }),
  ),
  http.post('/api/v1/datasources/test-connection', () =>
    HttpResponse.json({ success: true, message: 'Connection successful' }),
  ),
  http.post('/api/v1/datasources/:id/introspect', () =>
    HttpResponse.json([
      {
        id: 'cat-1',
        table_name: 'customers',
        columns: [{ name: 'id', type: 'integer' }],
        relationships: [],
        row_count: 8,
      },
    ]),
  ),
  http.get('/api/v1/datasources/:id/suggestions', ({ params }) => {
    const suggestions =
      params.id === 'ds-1'
        ? [
            'How many students are in each major?',
            'What are the top 5 majors by enrollment?',
            'Which department has the most students?',
          ]
        : ['What is the total amount by status?']
    return HttpResponse.json({ suggestions })
  }),
  // First call returns "processing", subsequent calls return "ready" —
  // exercises the polling path in tests.
  ...(() => {
    let suggestPollCount = 0
    return [
      http.post('/api/v1/datasources/:id/suggest-report', ({ params }) => {
        suggestPollCount = 0
        return HttpResponse.json({ status: 'processing', ds_id: params.id })
      }),
      http.get('/api/v1/datasources/:id/suggest-report/status', ({ params }) => {
        suggestPollCount += 1
        if (suggestPollCount <= 1) {
          return HttpResponse.json({ status: 'processing', ds_id: params.id })
        }
        return HttpResponse.json({
          status: 'ready',
          report: {
            question: 'What is the total revenue by region?',
            summary: 'North leads with $1.2M in total revenue.',
            sql: 'SELECT region, SUM(amount) AS total FROM sales GROUP BY region',
            rows: [
              { region: 'North', total: 1200000 },
              { region: 'South', total: 800000 },
            ],
            row_count: 2,
            chart_spec: { type: 'bar', title: 'Revenue by Region', x: 'region', y: 'total' },
            kpis: [{ label: 'TOP REGION', value: 'North', trend: 'flat' }],
            execution_time: 0.42,
            no_query: false,
            conversation_id: 'conv-suggested',
            turn_id: 'turn-suggested',
          },
          suggestions: [
            'Which customers have highest growth?',
            'How does revenue trend over the last 12 months?',
          ],
        })
      }),
    ]
  })(),
  http.put('/api/v1/datasources/:id/schema/:catalogId', ({ params }) =>
    HttpResponse.json({
      id: params.catalogId,
      table_name: 'customers',
      columns: [],
      relationships: [],
      row_count: 8,
    }),
  ),

  http.post('/api/v1/query', async ({ request }) => {
    const body = await request.json()
    const result = queryResponse(body.question)
    const lines = []
    for (let step = 0; step < 5; step += 1) {
      lines.push(JSON.stringify({ type: 'progress', step }))
    }
    lines.push(JSON.stringify({ type: 'result', ...result }))
    return HttpResponse.text(lines.join('\n'), {
      headers: { 'Content-Type': 'application/x-ndjson' },
    })
  }),

  http.get('/api/v1/conversations', ({ request }) => {
    const url = new URL(request.url)
    const dsId = url.searchParams.get('data_source_id')
    const list = dsId ? conversations.filter((c) => c.data_source_id === dsId) : conversations
    const page = Number(url.searchParams.get('page') ?? 1)
    const perPage = Math.min(Number(url.searchParams.get('per_page') ?? 20), 100)
    const start = (page - 1) * perPage
    const items = list.slice(start, start + perPage)
    return HttpResponse.json({
      items,
      total: list.length,
      page,
      per_page: perPage,
      pages: Math.ceil(list.length / perPage),
    })
  }),
  http.get('/api/v1/conversations/:id', () =>
    HttpResponse.json({ ...conversations[0], turns }),
  ),
  http.delete('/api/v1/conversations/:id', () => HttpResponse.json({ ok: true })),

  http.post('/api/v1/auth/request-access', async ({ request }) => {
    const body = await request.json()
    if (!body?.name || !body?.email) {
      return HttpResponse.json(
        { error: 'Name is required', code: 'missing_fields' },
        { status: 400 },
      )
    }
    if (body.email === 'taken@example.com') {
      return HttpResponse.json(
        { error: 'A request for this email is already under review', code: 'duplicate_request' },
        { status: 400 },
      )
    }
    return HttpResponse.json({
      message: 'Request received. We\'ll review it and get back to you.',
    })
  }),


  http.get('/api/v1/admin/access-requests', ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') ?? 'pending'
    const items = accessRequestsState.filter((item) => item.status === status)
    return HttpResponse.json({ total: items.length, limit: 50, offset: 0, items })
  }),
  http.post('/api/v1/admin/access-requests/:id/approve', ({ params }) => {
    const row = accessRequestsState.find((item) => item.id === params.id)
    if (row) {
      row.status = 'approved'
      row.decided_at = '2026-09-07T10:30:00+00:00'
      row.created_user_id = '88888888-8888-4888-8888-888888888888'
    }
    return HttpResponse.json({
      user: {
        id: '88888888-8888-4888-8888-888888888888',
        email: row ? row.email : 'cynthia@cofinacorp.com',
        role: 'user',
        status: 'pending',
      },
      invite_token: 'mock-invite-token-123',
      invite_expires_at: '2026-09-10T12:00:00+00:00',
      sample_granted: true,
    })
  }),

  http.post('/api/v1/admin/access-requests/:id/dismiss', ({ params }) => {
    const row = accessRequestsState.find((item) => item.id === params.id)
    if (row) {
      row.status = 'dismissed'
      row.decided_at = '2026-09-07T10:00:00+00:00'
    }
    return HttpResponse.json(row)
  }),
]

export function resetAccessRequestsMocks() {
  const [pending, approved, dismissed] = accessRequestsState
  pending.status = 'pending'
  pending.decided_at = null
  pending.decided_by = null
  pending.created_user_id = null
  approved.status = 'approved'
  dismissed.status = 'dismissed'
}
