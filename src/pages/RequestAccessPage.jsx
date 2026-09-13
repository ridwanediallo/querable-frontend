import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Alert, Typography } from 'antd'
import { CheckCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { apiFetch } from '../api'

const { Title, Text } = Typography

function RequestAccessPage() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleFinish = async ({ name, email, company, use_case }) => {
    setSubmitting(true)
    setFormError(null)
    try {
      const res = await apiFetch('/auth/request-access', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          company: company || undefined,
          use_case: use_case || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setFormError(data.error || `HTTP ${res.status}`)
        return
      }
      setSubmitted(true)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <div className="login-brand-icon">Q</div>
            <Title level={3} style={{ margin: 0 }}>Queryable</Title>
          </div>
          <Alert
            type="success"
            message="Request received"
            description="Thanks — we'll review your request and get back to you shortly with access."
            showIcon
            icon={<CheckCircleOutlined />}
            style={{ marginBottom: 16, borderRadius: 10 }}
          />
          <Button
            type="primary"
            block
            size="large"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/login')}
          >
            Back to sign in
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">Q</div>
          <Title level={3} style={{ margin: 0 }}>Queryable</Title>
        </div>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          Tell us a bit about yourself and we'll set you up with an account.
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
            label="Name"
            name="name"
            rules={[{ required: true, message: 'Enter your name' }]}
          >
            <Input placeholder="Your name" />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Enter your email' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <Input placeholder="you@company.com" />
          </Form.Item>

          <Form.Item label="Company (optional)" name="company">
            <Input placeholder="Company or team" />
          </Form.Item>

          <Form.Item label="What would you use Querable for? (optional)" name="use_case">
            <Input.TextArea
              rows={3}
              maxLength={500}
              placeholder="e.g. Automated reporting on our lending data"
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            Request access
          </Button>

          <Button
            type="text"
            block
            className="login-back"
            onClick={() => navigate('/login')}
          >
            Back to sign in
          </Button>
        </Form>
      </div>
    </div>
  )
}

export default RequestAccessPage
