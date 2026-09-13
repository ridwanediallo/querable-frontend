import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Alert, Typography } from 'antd'
import { MailOutlined, LockOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import useAuthStore from '../stores/useAuthStore'

const { Title, Text } = Typography

function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleFinish = async ({ email, password }) => {
    setSubmitting(true)
    setFormError(null)
    const result = await login(email, password)
    setSubmitting(false)
    if (result.ok) {
      navigate('/')
    } else {
      setFormError(result.error)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">Q</div>
          <Title level={3} style={{ margin: 0 }}>Queryable</Title>
        </div>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          Sign in to query your data sources
        </Text>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
          New here?{' '}
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate('/request-access')}>
            Request access
          </Button>
        </Text>

        {formError && (
          <Alert
            type="error"
            message={formError}
            showIcon
            style={{ marginBottom: 16, borderRadius: 10 }}
            closable
          />
        )}

        <Form layout="vertical" onFinish={handleFinish} requiredMark={false}>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Enter your email' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="you@example.com" size="large" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Enter your password' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
          </Form.Item>

          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            Sign in
          </Button>

          <Button
            type="link"
            block
            onClick={() => navigate('/forgot-password')}
            style={{ marginTop: 8 }}
          >
            Forgot password?
          </Button>

          <Button
            type="text"
            block
            icon={<ArrowLeftOutlined />}
            className="login-back"
            onClick={() => navigate('/')}
          >
            Back
          </Button>
        </Form>
      </div>
    </div>
  )
}

export default LoginPage
