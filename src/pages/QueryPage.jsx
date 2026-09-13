import { lazy, Suspense, useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Alert, Tooltip, message, Tag } from 'antd'
import {
  CheckSquareOutlined, LoadingOutlined, BorderOutlined,
  CodeOutlined, CopyOutlined, TableOutlined,
  FilePdfOutlined, FileExcelOutlined, ArrowRightOutlined,
  ReloadOutlined, DatabaseOutlined, LoginOutlined, BulbOutlined,
} from '@ant-design/icons'
import { format } from 'sql-formatter'
import hljs from 'highlight.js/lib/core'
import postgresql from 'highlight.js/lib/languages/sql'
import 'highlight.js/styles/github.css'
import useQueryStore from '../stores/useQueryStore'
import useDatasourceStore from '../stores/useDatasourceStore'
import useAuthStore from '../stores/useAuthStore'
import DemoRequestFunnel from '../components/features/DemoRequestModal'
const ChartSpec = lazy(() => import('../components/features/ChartSpec'))
import KpiCard from '../components/features/KpiCard'

hljs.registerLanguage('postgresql', postgresql)

const PIPELINE_STEPS = [
  'Schema analyzed',
  'Query written',
  'Validated',
  'Data retrieved',
  'Report composed',
]

function parseSuggestions(text) {
  if (!text) return []
  const match = text.match(/SUGGESTIONS:\s*([\s\S]*)/i)
  if (!match) return []
  return match[1]
    .trim()
    .split('\n')
    .map((line) => line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim())
    .filter(Boolean)
}

function stripSuggestions(text) {
  if (!text) return text
  return text.replace(/SUGGESTIONS:\s*[\s\S]*/i, '').trim()
}

function formatSql(sql) {
  // sql-formatter's parser can reject some generated/edge SQL; never crash
  // the report panel — fall back to the raw query.
  try {
    return format(sql, { language: 'postgresql', tabWidth: 2 })
  } catch {
    return sql
  }
}

function labelize(field) {
  return String(field).replace(/_/g, ' ')
}

const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

function deriveKpis(turn) {
  // Prefer real KPIs computed by the backend from actual query results
  if (turn.kpis && turn.kpis.length > 0) {
    return turn.kpis
  }

  const { chartSpec, rows } = turn
  if (!chartSpec || !chartSpec.x || !chartSpec.y || !rows || rows.length === 0) {
    return []
  }
  const x = chartSpec.x
  const y = chartSpec.y
  const values = rows
    .map((r) => Number(r[y]))
    .filter((v) => !Number.isNaN(v))
  if (values.length === 0) return []

  let top = rows[0]
  for (const r of rows) {
    if (Number(r[y]) > Number(top[y])) top = r
  }
  const total = values.reduce((a, b) => a + b, 0)

  return [
    { label: `Top ${labelize(x)}`, value: String(top[x]) },
    { label: labelize(y), value: numberFmt.format(Number(top[y])) },
    { label: `Total ${labelize(y)}`, value: numberFmt.format(total) },
  ]
}

function PipelineChips({ steps, doneCount, activeIndex }) {
  return (
    <div className="pipeline-chips">
      {steps.map((label, i) => {
        const done = i < doneCount
        const active = i === activeIndex
        return (
          <span key={label} className={'pipeline-chip' + (done || active ? '' : ' pending')}>
            {done ? (
              <CheckSquareOutlined />
            ) : active ? (
              <LoadingOutlined spin style={{ color: 'var(--accent)' }} />
            ) : (
              <BorderOutlined />
            )}
            {label}
          </span>
        )
      })}
    </div>
  )
}

function UserBubble({ turn }) {
  return (
    <div className="user-bubble">
      {turn.question}
      {turn.questionResolved && (
        <span className="resolved">Resolved to: {turn.questionResolved}</span>
      )}
    </div>
  )
}

function ReportPanel({ turn }) {
  const hasData = Boolean(turn.rows && turn.rows.length > 0 && !turn.noQuery)
  const hasEmptyResult = Boolean(
    turn.sql && !turn.noQuery && (!turn.rows || turn.rows.length === 0)
  )
  const [view, setView] = useState(() => {
    if (hasData) return 'data'
    if (turn.sql) return 'sql'
    return null
  })
  const reportRef = useRef(null)

  const kpis = deriveKpis(turn)
  const narrative = stripSuggestions(turn.summary)

  const columns =
    turn.rows && turn.rows.length > 0
      ? Object.keys(turn.rows[0]).map((key) => ({
          title: key,
          dataIndex: key,
          key,
          render: (val) => (val !== null && val !== undefined ? String(val) : '-'),
        }))
      : []

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(turn.sql)
      message.success('SQL copied')
    } catch {
      message.error('Could not copy')
    }
  }

  const handleExportPDF = async () => {
    if (!reportRef.current) return
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const canvas = await html2canvas(reportRef.current, { scale: 2 })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pdfWidth
      const imgHeight = (canvas.height * pdfWidth) / canvas.width

      // If the image fits on one page, add it directly.
      if (imgHeight <= pdfHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      } else {
        // Split across multiple pages. Each page gets a slice of the canvas.
        let yOffset = 0
        const sliceHeightPx = (pdfHeight / imgHeight) * canvas.height
        while (yOffset < canvas.height) {
          if (yOffset > 0) pdf.addPage()
          // Create a slice of the canvas for this page
          const sliceCanvas = document.createElement('canvas')
          sliceCanvas.width = canvas.width
          sliceCanvas.height = Math.min(sliceHeightPx, canvas.height - yOffset)
          const ctx = sliceCanvas.getContext('2d')
          ctx.drawImage(
            canvas,
            0, yOffset, canvas.width, sliceCanvas.height,
            0, 0, canvas.width, sliceCanvas.height,
          )
          const sliceData = sliceCanvas.toDataURL('image/png')
          const sliceImgHeight = (sliceCanvas.height * pdfWidth) / canvas.width
          pdf.addImage(sliceData, 'PNG', 0, 0, pdfWidth, sliceImgHeight)
          yOffset += sliceHeightPx
        }
      }
      pdf.save('query-report.pdf')
    } catch {
      message.error('PDF export failed')
    }
  }

  const handleExportExcel = async () => {
    if (!turn.rows || turn.rows.length === 0) return
    try {
      const { Workbook } = await import('exceljs')
      const wb = new Workbook()
      const ws = wb.addWorksheet('Results')
      if (turn.rows.length > 0) {
        ws.columns = Object.keys(turn.rows[0]).map((key) => ({ header: key, key }))
        turn.rows.forEach((row) => ws.addRow(row))
      }
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'query-results.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('Excel export failed')
    }
  }

  const renderChart = () => {
    return (
      <Suspense fallback={<div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading chart…</div>}>
        <ChartSpec spec={turn.chartSpec} rows={turn.rows} />
      </Suspense>
    )
  }

  const pipelineSteps = turn.noQuery
    ? ['Schema analyzed', 'Report composed']
    : PIPELINE_STEPS

  return (
    <div className="report-panel" ref={reportRef}>
      <PipelineChips steps={pipelineSteps} doneCount={pipelineSteps.length} activeIndex={-1} />

      {!turn.noQuery && kpis.length > 0 && (
        <div className="kpi-row">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} kpi={kpi} />
          ))}
        </div>
      )}

      {renderChart()}

      {narrative && <p className="narrative">{narrative}</p>}

      {hasEmptyResult && (
        <Alert
          type="info"
          showIcon
          className="empty-result-alert"
          message="No matching rows in this data source"
          description="The query completed successfully, but it did not return any rows for the selected period or filters. You can review the SQL below or try a broader date range."
        />
      )}

      {(turn.sql || (turn.rows && turn.rows.length > 0)) && (
        <>
          <hr className="report-divider" />
          <div className="report-toggles">
            {turn.sql && (
              <>
                <button
                  className={'link-toggle' + (view === 'sql' ? ' active' : '')}
                  onClick={() => setView('sql')}
                >
                  <CodeOutlined /> View SQL
                </button>
                <Tooltip title="Copy SQL">
                  <button className="icon-btn" onClick={handleCopySql}>
                    <CopyOutlined />
                  </button>
                </Tooltip>
              </>
            )}
            {hasData && (
              <>
                <button
                  className={'link-toggle' + (view === 'data' ? ' active' : '')}
                  onClick={() => setView('data')}
                >
                  <TableOutlined /> View data
                  <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>
                    ({turn.rowCount} row{turn.rowCount !== 1 ? 's' : ''}
                    {turn.executionTime != null ? ` · ${turn.executionTime}s` : ''})
                  </span>
                </button>
                <Tooltip title="Export PDF">
                  <button className="icon-btn" onClick={handleExportPDF}>
                    <FilePdfOutlined />
                  </button>
                </Tooltip>
                <Tooltip title="Export Excel">
                  <button className="icon-btn" onClick={handleExportExcel}>
                    <FileExcelOutlined />
                  </button>
                </Tooltip>
              </>
            )}
          </div>

          {view === 'sql' && turn.sql && (
            <pre className="sql-block">
              <code
                dangerouslySetInnerHTML={{
                  __html: hljs.highlight(
                    formatSql(turn.sql),
                    { language: 'postgresql' }
                  ).value,
                }}
              />
            </pre>
          )}

          {view === 'data' && hasData && (
            <div className="data-card">
              <Table
                columns={columns}
                dataSource={turn.rows.map((row, i) => ({ ...row, key: i }))}
                pagination={{ pageSize: 5, showSizeChanger: false, size: 'small' }}
                size="small"
                scroll={{ x: 'max-content' }}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function LoadingPanel() {
  const stepsDone = useQueryStore((s) => s.stepsDone)
  return (
    <div className="report-panel loading-panel" aria-busy="true" aria-label="Loading report">
      <div className="loading-status">
        <LoadingOutlined spin style={{ color: 'var(--accent)' }} />
        <span>Working on your report…</span>
      </div>

      <PipelineChips steps={PIPELINE_STEPS} doneCount={stepsDone} activeIndex={stepsDone} />

      <div className="skeleton skeleton-chart" />
      <p className="skeleton skeleton-line skeleton-narrative" />
      <p className="skeleton skeleton-line" style={{ width: '85%' }} />
      <p className="skeleton skeleton-line" style={{ width: '65%' }} />
    </div>
  )
}

function GuestQuotaBanner({ quota }) {
  const navigate = useNavigate()
  if (!quota) return null
  const { limit, used, remaining } = quota
  const exhausted = remaining <= 0
  return (
    <div className={'guest-quota-banner' + (exhausted ? ' exhausted' : '')}>
      <Tag color={exhausted ? 'red' : 'default'} style={{ marginRight: 8 }}>
        Guest {used}/{limit}
      </Tag>
      <span>
        {exhausted
          ? 'Guest query limit reached.'
          : `${remaining} guest quer${remaining === 1 ? 'y' : 'ies'} remaining this session.`}
      </span>
      {exhausted && (
        <Button type="link" size="small" icon={<LoginOutlined />} onClick={() => navigate('/login')}>
          Sign in to keep querying
        </Button>
      )}
    </div>
  )
}

function QueryPage() {
  const {
    turns, loading, error, submitQuery, newConversation, conversationId,
    suggestions, fetchSuggestions, lastFailedQuestion,
    suggestStatus, suggestReport, applySuggestedReport,
    startSuggestReport, checkSuggestStatus, _suggestAutoTriggered,
  } = useQueryStore()

  const { selectedDatasourceId } = useDatasourceStore()
  const user = useAuthStore((s) => s.user)
  const guestQuota = useAuthStore((s) => s.guestQuota)

  const [localQuestion, setLocalQuestion] = useState('')
  const threadEndRef = useRef(null)
  const _suggestAutoTriggeredSession = useRef(_suggestAutoTriggered)

  const hasTurns = turns.length > 0
  const isGuest = !user
  const quotaExhausted = isGuest && guestQuota && guestQuota.remaining <= 0

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns.length, loading])

  // Load schema-aware starter suggestions whenever an empty session is shown
  // for a datasource.
  useEffect(() => {
    if (!hasTurns && !loading && selectedDatasourceId) {
      fetchSuggestions(selectedDatasourceId)
    }
  }, [hasTurns, loading, selectedDatasourceId, fetchSuggestions])

  // Auto-trigger suggest report once per login session when empty session is shown.
  // Uses a synchronous ref guard so it never races with the async checkSuggestStatus
  // on mount (which may already have a cached "ready" result).
  useEffect(() => {
    if (!hasTurns && !loading && selectedDatasourceId && suggestStatus === 'idle'
        && !_suggestAutoTriggered && !_suggestAutoTriggeredSession.current) {
      _suggestAutoTriggeredSession.current = true
      startSuggestReport(selectedDatasourceId)
      useQueryStore.setState({ _suggestAutoTriggered: true })
      try { sessionStorage.setItem('suggestAutoTriggered', '1') } catch {}
    }
  }, [hasTurns, loading, selectedDatasourceId, suggestStatus, _suggestAutoTriggered, startSuggestReport])

  // On mount, check if a suggest-report was already running (e.g. after page reload).
  // Resumes polling or loads the result if ready.
  useEffect(() => {
    if (selectedDatasourceId) {
      checkSuggestStatus(selectedDatasourceId)
    }
  }, [selectedDatasourceId, checkSuggestStatus])

  const handleSubmit = () => {
    const q = localQuestion.trim()
    if (!q || useQueryStore.getState().loading) return
    submitQuery(q)
    setLocalQuestion('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleRetry = () => {
    // A failed submit never creates a turn, so prefer the failed question;
    // fall back to the last turn only when there is nothing failed to redo.
    const question = lastFailedQuestion ?? turns[turns.length - 1]?.question
    if (question) submitQuery(question)
  }

  const latestTurn = hasTurns ? turns[turns.length - 1] : null
  const followUpSuggestions = latestTurn && !loading ? parseSuggestions(latestTurn.summary) : []

  return (
    <>
      <div className="thread">
        <div className="thread-inner">
          {!hasTurns && !loading && (
            <div className="empty-state">
              <div className="empty-state-icon">
                <DatabaseOutlined />
              </div>
              <h2>Ask your data anything</h2>
              {suggestStatus === 'ready' && suggestReport && (
                <div className="insight-hero">
                  <div className="insight-hero-icon" aria-hidden>
                    <BulbOutlined />
                  </div>
                  <div className="insight-hero-body">
                    <div className="insight-hero-label">
                      We found something interesting in your data
                    </div>
                    <div className="insight-hero-question">{suggestReport.question}</div>
                  </div>
                  <Button type="primary" onClick={applySuggestedReport}>
                    View insight
                  </Button>
                </div>
              )}
              {suggestions.length > 0 && (
                <div className="starter-suggestions">
                  <div className="starter-label">Try one of these:</div>
                  <div className="suggestion-row">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        className="suggestion-chip"
                        style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
                        onClick={() => submitQuery(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {turns.map((turn, i) => (
            <div key={turn.id || i}>
              <UserBubble turn={turn} />
              {(turn.summary || turn.sql) && (
                <ReportPanel turn={turn} />
              )}
            </div>
          ))}

          {loading && <LoadingPanel />}

          {error && (
            <Alert
              type="error"
              message="Query failed"
              description={error}
              showIcon
              style={{ marginBottom: 16, borderRadius: 10 }}
              closable
              action={
                <Button size="small" icon={<ReloadOutlined />} onClick={handleRetry}>
                  Retry
                </Button>
              }
            />
          )}

          {followUpSuggestions.length > 0 && (
            <div className="suggestion-row">
              {followUpSuggestions.map((s, i) => (
                <button
                  key={i}
                  className="suggestion-chip"
                  style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
                  disabled={loading}
                  onClick={() => submitQuery(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {followUpSuggestions.length === 0 && suggestions.length > 0 && hasTurns && !loading && (
            <div className="suggestion-row">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="suggestion-chip"
                  style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
                  onClick={() => submitQuery(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div ref={threadEndRef} />
        </div>
      </div>

      <div className="composer">
        <DemoRequestFunnel isGuest={isGuest} />
        <GuestQuotaBanner quota={isGuest ? guestQuota : null} />
        <div className="composer-inner">
          <textarea
            className="composer-input"
            rows={1}
            placeholder={
              quotaExhausted
                ? 'Guest limit reached — sign in to keep querying'
                : conversationId
                  ? 'Ask a follow-up question'
                  : 'Ask a question about your data'
            }
            value={localQuestion}
            onChange={(e) => setLocalQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || quotaExhausted}
          />
          <button
            className="composer-send"
            onClick={handleSubmit}
            disabled={!localQuestion.trim() || loading || quotaExhausted}
            title="Send"
          >
            <ArrowRightOutlined />
          </button>
        </div>
        {hasTurns && (
          <div style={{ maxWidth: 1000, margin: '6px auto 0', textAlign: 'right' }}>
            <Button size="small" type="text" onClick={newConversation} disabled={loading}>
              Start new session
            </Button>
          </div>
        )}
      </div>
    </>
  )
}

export default QueryPage
