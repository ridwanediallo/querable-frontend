import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Spin, Alert } from 'antd'
import Sidebar from './components/layout/Sidebar'
import TopBar from './components/layout/TopBar'
import AdminLayout from './components/layout/AdminLayout'
import ErrorBoundary from './components/shared/ErrorBoundary'
import useAuthStore from './stores/useAuthStore'

const QueryPage = lazy(() => import('./pages/QueryPage'))
const DatasourcePage = lazy(() => import('./pages/DatasourcePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const AuditPage = lazy(() => import('./pages/AuditPage'))
const DemoRequestsPage = lazy(() => import('./pages/DemoRequestsPage'))
const AcceptInvitePage = lazy(() => import('./pages/AcceptInvitePage'))

function AppShell({ authKey }) {
  const migratedCount = useAuthStore((s) => s.migratedCount)
  const clearMigratedCount = () => useAuthStore.setState({ migratedCount: null })

  return (
    <div className="app-shell" key={authKey}>
      <Sidebar />
      <div className="app-main">
        <TopBar />
        {migratedCount !== null && (
          <Alert
            type="success"
            message={`We found ${migratedCount} conversation${migratedCount === 1 ? '' : 's'} from your guest session and added them to your account.`}
            banner
            closable
            onClose={clearMigratedCount}
            style={{ marginBottom: 0 }}
          />
        )}
        <Outlet />
      </div>
    </div>
  )
}

function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const loading = useAuthStore((s) => s.loading)
  const user = useAuthStore((s) => s.user)
  const authKey = user?.id ? `user:${user.id}` : 'guest'

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  if (loading) {
    return (
      <div className="app-loading">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <ErrorBoundary>
      <Routes>
        <Route path="/invite" element={<Suspense fallback={<div className="app-loading"><Spin size="large" /></div>}><AcceptInvitePage /></Suspense>} />
        <Route path="/forgot-password" element={<Suspense fallback={<div className="app-loading"><Spin size="large" /></div>}><ForgotPasswordPage /></Suspense>} />
        <Route path="/reset-password" element={<Suspense fallback={<div className="app-loading"><Spin size="large" /></div>}><ResetPasswordPage /></Suspense>} />
        <Route path="/admin" element={<AdminLayout key={authKey} />}>
          <Route index element={<Navigate to="/admin/users" replace />} />
          <Route path="users" element={<Suspense fallback={<div className="app-loading"><Spin size="large" /></div>}><UsersPage /></Suspense>} />
          <Route path="datasources" element={<Suspense fallback={<div className="app-loading"><Spin size="large" /></div>}><DatasourcePage /></Suspense>} />
          <Route path="demo-requests" element={<Suspense fallback={<div className="app-loading"><Spin size="large" /></div>}><DemoRequestsPage /></Suspense>} />
          <Route path="audit-log" element={<Suspense fallback={<div className="app-loading"><Spin size="large" /></div>}><AuditPage /></Suspense>} />
        </Route>
        <Route element={<AppShell authKey={authKey} />}>
          <Route path="/login" element={<Suspense fallback={<div className="app-loading"><Spin size="large" /></div>}><LoginPage /></Suspense>} />
          <Route path="/" element={<Suspense fallback={<div className="app-loading"><Spin size="large" /></div>}><QueryPage /></Suspense>} />
          <Route path="/datasources" element={<Navigate to="/admin/datasources" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export default App
