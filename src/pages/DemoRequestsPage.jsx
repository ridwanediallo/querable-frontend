import { useEffect, useState } from 'react'
import { Button, Card, Modal, Popconfirm, Segmented, Table, Tag, Typography } from 'antd'
import {
  CheckOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import useAdminStore, { ADMIN_PAGE_SIZE } from '../stores/useAdminStore'
import { friendlyError } from '../errors'
import { relativeTime } from '../lib/relativeTime'

const { Text } = Typography

const STATUS_OPTIONS = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Dismissed', value: 'dismissed' },
]

function DemoRequestsPage() {
  const {
    demoRequests,
    demoRequestsTotal,
    demoRequestsLoading,
    fetchDemoRequests,
    approveDemoRequest,
    dismissDemoRequest,
  } = useAdminStore()

  const [status] = useState('pending')
  const [page, setPage] = useState(1)
  const [showInvite, setShowInvite] = useState(null)

  const load = (pageToLoad = 1, statusToLoad = status) => {
    fetchDemoRequests({
      status: statusToLoad,
      limit: ADMIN_PAGE_SIZE,
      offset: (pageToLoad - 1) * ADMIN_PAGE_SIZE,
    })
    setPage(pageToLoad)
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleApprove = async (request) => {
    const result = await approveDemoRequest(request.id)
    if (!result.ok) {
      Modal.error({
        title: 'Could not approve this demo request',
        content: friendlyError(result),
      })
      return
    }

    if (result.data.note) {
      Modal.success({
        title: 'Demo request approved',
        content: result.data.note,
      })
    } else {
      setShowInvite({ email: request.email })
    }
    load(page, status)
  }

  const handleDismiss = async (request) => {
    const result = await dismissDemoRequest(request.id)
    if (result.ok) {
      load(page, status)
    } else {
      Modal.error({
        title: 'Could not dismiss this demo request',
        content: friendlyError(result),
      })
    }
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (value, record) => (
        <div>
          <Text strong>{value}</Text>
          <div>
            <Text type="secondary">{record.email}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
      render: (value) => value || <Text type="secondary">—</Text>,
    },
    {
      title: 'Use case',
      dataIndex: 'use_case',
      key: 'use_case',
      render: (value) =>
        value ? (
          <span className="demo-request-use-case">{value}</span>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value) => (
        <Tag color={value === 'pending' ? 'orange' : value === 'approved' ? 'green' : 'default'}>
          {value}
        </Tag>
      ),
    },
    {
      title: 'Requested',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (value) => <Text type="secondary">{relativeTime(value)}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 190,
      render: (_, request) =>
        request.status === 'pending' ? (
          <div className="demo-request-actions-cell">
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => handleApprove(request)}
            >
              Approve
            </Button>
            <Popconfirm
              title="Dismiss this demo request?"
              description="The lead will be closed and removed from the pending queue."
              onConfirm={() => handleDismiss(request)}
              okText="Dismiss"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
            >
              <Button size="small" icon={<CloseOutlined />}>
                Dismiss
              </Button>
            </Popconfirm>
          </div>
        ) : (
          <Text type="secondary">
            {request.status === 'approved' ? 'Approved' : 'Dismissed'}
          </Text>
        ),
    },
  ]

  return (
    <div className="page-pad">
      <div className="admin-page-header">
        <div>
          <h3 className="admin-page-title">Demo requests</h3>
          <Text type="secondary">Leads captured by the public demo CTA</Text>
        </div>
        <div className="admin-page-actions">
          <Segmented options={STATUS_OPTIONS} value={status} onChange={(value) => load(1, value)} />
          <Button icon={<ReloadOutlined />} onClick={() => load(1, status)}>
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={demoRequests.map((request) => ({ ...request, key: request.id }))}
          loading={demoRequestsLoading}
          locale={{ emptyText: 'No demo requests in this queue.' }}
          pagination={
            demoRequestsTotal > ADMIN_PAGE_SIZE
              ? {
                  current: page,
                  total: demoRequestsTotal,
                  pageSize: ADMIN_PAGE_SIZE,
                  showSizeChanger: false,
                  onChange: (value) => load(value, status),
                }
              : false
          }
        />
      </Card>

      <Modal open={Boolean(showInvite)} footer={null} onCancel={() => setShowInvite(null)} title="Invite sent">
        {showInvite && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
            <div>
              <Text>
                An invite email has been sent to{' '}
                <Text strong>{showInvite.email}</Text>.
              </Text>
            </div>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                They'll receive a link to set their password and sign in.
              </Text>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default DemoRequestsPage
