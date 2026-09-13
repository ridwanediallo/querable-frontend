import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Button,
  Card,
  Dropdown,
  Input,
  Modal,
  Table,
  Typography,
  message,
} from 'antd'
import { CheckCircleOutlined, MoreOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import useAdminStore, { ADMIN_PAGE_SIZE } from '../stores/useAdminStore'
import useAuthStore from '../stores/useAuthStore'
import InviteUserModal from '../components/features/InviteUserModal'
import UserDetailDrawer from '../components/features/UserDetailDrawer'
import { confirmDeactivate, confirmRevokeSession } from '../components/features/adminActions'
import { initials } from '../initials'
import { friendlyError } from '../errors'
import { relativeTime } from '../lib/relativeTime'

const { Title, Text } = Typography

const STATUS_META = {
  active: { label: 'Active', className: 'status-active' },
  pending: { label: 'Pending invite', className: 'status-pending' },
  deactivated: { label: 'Deactivated', className: 'status-deactivated' },
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.active
  return (
    <span className={`status-badge ${meta.className}`}>
      <span className="status-dot" aria-hidden="true" />
      {meta.label}
    </span>
  )
}

function RoleTag({ role }) {
  return (
    <span className={`role-tag ${role === 'admin' ? 'role-admin' : 'role-user'}`}>
      {role === 'admin' ? 'Admin' : 'User'}
    </span>
  )
}

function UsersPage() {
  const currentUser = useAuthStore((s) => s.user)
  const {
    users, usersTotal, usersLoading, activeAdminCount,
    page,
    fetchUsers, updateUser, revokeSessions, regenerateInvite, cancelInvite,
  } = useAdminStore()

  const [search, setSearch] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  // Debounce search: wait 300ms after the user stops typing before fetching.
  const debounceRef = useRef(null)
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchUsers({ query: search.trim(), page: 1 })
    }, 300)
    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const isLastAdmin = (user) =>
    user.role === 'admin' &&
    user.status === 'active' &&
    activeAdminCount <= 1

  const handleResend = async (user) => {
    const result = await regenerateInvite(user.id)
    if (!result.ok) {
      message.error(friendlyError(result))
      return
    }
    Modal.success({
      title: 'Invite sent',
      width: 480,
      content: (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
          <div>
            <Text>
              An invite email has been sent to{' '}
              <Text strong>{user.email}</Text>.
            </Text>
          </div>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">
              They'll receive a link to set their password and sign in.
            </Text>
          </div>
        </div>
      ),
    })
  }

  const handleRevokeInvite = (user) => {
    Modal.confirm({
      title: `Revoke the pending invite for ${user.email}?`,
      content: 'The invite link will stop working.',
      okText: 'Revoke invite',
      okButtonProps: { danger: true },
      onOk: async () => {
        const result = await cancelInvite(user.id)
        if (result.ok) {
          message.success('Invite revoked')
        } else {
          message.error(friendlyError(result))
        }
      },
    })
  }

  const menuFor = (user) => {
    if (user.status === 'pending') {
      return [
        { key: 'resend', label: 'Resend invite', onClick: () => handleResend(user) },
        {
          key: 'revoke-invite',
          label: 'Revoke invite',
          danger: true,
          onClick: () => handleRevokeInvite(user),
        },
      ]
    }
    return [
      { key: 'details', label: 'View details', onClick: () => setSelectedId(user.id) },
      ...(user.has_active_session
        ? [
            {
              key: 'revoke-session',
              label: 'Revoke session',
              onClick: () => confirmRevokeSession(user, revokeSessions),
            },
          ]
        : []),
      user.is_active
        ? {
            key: 'deactivate',
            label: 'Deactivate account',
            danger: true,
            onClick: () => confirmDeactivate(user, currentUser?.id === user.id, updateUser),
          }
        : {
            key: 'reactivate',
            label: 'Reactivate account',
            onClick: async () => {
              const result = await updateUser(user.id, { is_active: true })
              if (!result.ok) message.error(friendlyError(result))
            },
          },
    ]
  }

  const formatTokens = (n) => {
    if (!n) return '0'
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
  }

  const columns = [
    {
      title: 'Name',
      key: 'name',
      render: (_, user) => (
        <div className="user-cell">
          <div className="sidebar-avatar">{initials(user.name, user.email)}</div>
          <div>
            <div className="user-cell-name">{user.name || user.email}</div>
            {user.name && <div className="user-cell-email">{user.email}</div>}
          </div>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 110,
      render: (role) => <RoleTag role={role} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status) => <StatusBadge status={status} />,
    },
    {
      title: 'Queries',
      dataIndex: 'turn_count',
      key: 'turn_count',
      width: 80,
      render: (value) => <Text>{value || 0}</Text>,
    },
    {
      title: 'Tokens',
      dataIndex: 'total_tokens',
      key: 'total_tokens',
      width: 90,
      render: (value) => <Text type="secondary">{formatTokens(value)}</Text>,
    },
    {
      title: 'Last login',
      dataIndex: 'last_login_at',
      key: 'last_login_at',
      width: 130,
      render: (value) => <Text type="secondary">{relativeTime(value)}</Text>,
    },
    {
      key: 'actions',
      width: 60,
      render: (_, user) =>
        currentUser?.id === user.id ? (
          <Text type="secondary" className="user-you">
            You
          </Text>
        ) : (
          <Dropdown menu={{ items: menuFor(user) }} trigger={['click']}>
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              aria-label="User actions"
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        ),
    },
  ]

  const selectedUser = users.find((u) => u.id === selectedId) || null

  return (
    <div className="page-pad">
      <div className="admin-page-header">
        <Title level={3} className="admin-page-title" style={{ marginBottom: 0 }}>
          Users
        </Title>
        <div className="admin-page-actions">
          <Link to="/admin/audit-log">
            <Button>Audit log</Button>
          </Link>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setInviteOpen(true)}
          >
            Invite user
          </Button>
        </div>
      </div>

      <Input
        className="admin-search"
        prefix={<SearchOutlined />}
        placeholder="Search users"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
      />

      <Card>
        <Table
          columns={columns}
          dataSource={users.map((u) => ({ ...u, key: u.id }))}
          loading={usersLoading}
          locale={{ emptyText: search ? 'No users match your search.' : 'No users yet' }}
          onRow={(user) => ({
            onClick: () => setSelectedId(user.id),
            style: { cursor: 'pointer' },
          })}
          pagination={
            usersTotal > ADMIN_PAGE_SIZE
              ? {
                  current: page,
                  total: usersTotal,
                  pageSize: ADMIN_PAGE_SIZE,
                  showSizeChanger: false,
                  onChange: (p) => fetchUsers({ page: p }),
                }
              : false
          }
        />
      </Card>

      <InviteUserModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <UserDetailDrawer
        user={selectedUser}
        open={selectedUser !== null}
        onClose={() => setSelectedId(null)}
        isLastAdmin={isLastAdmin}
      />
    </div>
  )
}

export default UsersPage
