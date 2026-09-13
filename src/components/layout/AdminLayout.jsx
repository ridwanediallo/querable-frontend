import { Spin } from 'antd'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  MailOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import useAuthStore from '../../stores/useAuthStore'
import SidebarShell from './SidebarShell'

const NAV_ITEMS = [
  { to: '/admin/users', label: 'Users', icon: <TeamOutlined /> },
  { to: '/admin/datasources', label: 'Datasource access', icon: <DatabaseOutlined /> },
  { to: '/admin/demo-requests', label: 'Demo requests', icon: <MailOutlined /> },
  { to: '/admin/audit-log', label: 'Audit log', icon: <FileTextOutlined /> },
]

function AdminLayout() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  if (loading) {
    return <div className="app-loading"><Spin size="large" /></div>
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="app-shell">
      <SidebarShell
        actionIcon={<ArrowLeftOutlined style={{ fontSize: 12 }} />}
        actionLabel="Back to app"
        onAction={() => navigate('/')}
        sectionLabel="ADMIN CONSOLE"
      >
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                'sidebar-recent-item admin-nav-item' + (isActive ? ' active' : '')
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </SidebarShell>

      <div className="app-main">
        <Outlet />
      </div>
    </div>
  )
}

export default AdminLayout
