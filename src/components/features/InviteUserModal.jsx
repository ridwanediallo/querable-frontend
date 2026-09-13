import { useState } from 'react'
import { Button, Form, Input, Modal, Select, Typography, message } from 'antd'
import { CheckCircleOutlined, MailOutlined } from '@ant-design/icons'
import useAdminStore from '../../stores/useAdminStore'
import { friendlyError } from '../../errors'

const { Text } = Typography

function InviteUserModal({ open, onClose }) {
  const [form] = Form.useForm()
  const inviteUser = useAdminStore((s) => s.inviteUser)
  const [submitting, setSubmitting] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)

  const reset = () => {
    form.resetFields()
    setInviteResult(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFinish = async ({ email, name, role }) => {
    setSubmitting(true)
    const result = await inviteUser({ email, name: name || undefined, role })
    setSubmitting(false)
    if (!result.ok) {
      message.error(friendlyError(result))
      return
    }
    setInviteResult(result.data)
  }

  return (
    <Modal
      title={inviteResult ? 'Invite sent' : 'Invite user'}
      open={open}
      onCancel={handleClose}
      footer={
        inviteResult
          ? [
              <Button key="done" type="primary" onClick={handleClose}>
                Done
              </Button>,
            ]
          : null
      }
      destroyOnHidden
    >
      {inviteResult ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
          <div>
            <Text>
              An invite email has been sent to{' '}
              <Text strong>{inviteResult.user.email}</Text>.
            </Text>
          </div>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">
              They'll receive a link to set their password and sign in.
            </Text>
          </div>
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={handleFinish}
          initialValues={{ role: 'user' }}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Enter their email' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="teammate@example.com" />
          </Form.Item>
          <Form.Item label="Name" name="name" extra="Optional — they can fill it in when accepting.">
            <Input placeholder="Full name" />
          </Form.Item>
          <Form.Item label="Role" name="role">
            <Select
              options={[
                { value: 'user', label: 'User' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            Send invite
          </Button>
        </Form>
      )}
    </Modal>
  )
}

export default InviteUserModal
