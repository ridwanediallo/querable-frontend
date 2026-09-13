import { useEffect, useState } from 'react'
import { Button, Form, Input, Modal, message } from 'antd'
import { apiFetch } from '../../api'

const DISMISS_KEY = 'querable-demo-cta-dismissed'

function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return true
  }
}

function writeDismissed() {
  try {
    sessionStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // sessionStorage can be unavailable; the CTA just reappears next session.
  }
}

function DemoRequestModal({ open, onClose, onSubmitted }) {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!open) return
    form.resetFields()
    setSubmitted(false)
  }, [open, form])

  const handleSubmit = async (values) => {
    setSubmitting(true)
    try {
      const res = await apiFetch('/auth/request-demo', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          company: values.company?.trim() || undefined,
          use_case: values.use_case?.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
      setSubmitted(true)
      onSubmitted?.()
      message.success('Demo request received.')
    } catch (err) {
      message.error(err.message || 'Could not submit demo request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="See Querable live"
      width={520}
      centered
      destroyOnClose
    >
      {submitted ? (
        <div className="demo-request-success">
          <h3>Request received</h3>
          <p>
            Thanks for your interest. We'll review your workspace details and reach out
            shortly to schedule a short walkthrough.
          </p>
          <Button type="primary" onClick={onClose}>
            Continue exploring
          </Button>
        </div>
      ) : (
        <div className="demo-request-body">
          <p className="demo-request-copy">
            Querable turns your database into a report assistant. Ask a business
            question in plain English and get a query result, chart, and narrative
            report without writing SQL.
          </p>
          <ul className="demo-request-points">
            <li>Ask questions instead of building reports</li>
            <li>See query results, KPIs, and charts</li>
            <li>Connect your own database during the demo</li>
          </ul>
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={handleSubmit}
          >
            <div className="demo-request-grid">
              <Form.Item
                name="name"
                label="Name"
                rules={[
                  { required: true, message: 'Enter your name' },
                  { max: 120, message: 'Name must be at most 120 characters' },
                ]}
              >
                <Input placeholder="Cynthia Sarr" name="name" autoComplete="name" />
              </Form.Item>
              <Form.Item
                name="email"
                label="Work email"
                rules={[
                  { required: true, message: 'Enter your email' },
                  { type: 'email', message: 'Enter a valid email' },
                ]}
              >
                <Input placeholder="cynthia@company.com" name="email" autoComplete="email" />
              </Form.Item>
            </div>
            <Form.Item
              name="company"
              label="Company"
              rules={[{ max: 120, message: 'Company must be at most 120 characters' }]}
            >
              <Input placeholder="Company name (optional)" name="company" autoComplete="organization" />
            </Form.Item>
            <Form.Item
              name="use_case"
              label="What would you like to see?"
              rules={[{ max: 500, message: 'Use case must be at most 500 characters' }]}
            >
              <Input.TextArea
                rows={3}
                placeholder="For example: customer revenue trends and monthly lender reports (optional)"
                name="use_case"
              />
            </Form.Item>
            <div className="demo-request-actions">
              <Button onClick={onClose}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                Request demo
              </Button>
            </div>
          </Form>
        </div>
      )}
    </Modal>
  )
}

function DemoRequestFunnel({ isGuest }) {
  const [dismissed, setDismissed] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setDismissed(readDismissed())
  }, [])

  if (!isGuest) return null
  if (dismissed && !open) return null

  return (
    <>
      <button
        type="button"
        className="demo-cta"
        onClick={() => setOpen(true)}
        title="Request a live product demo"
      >
        Request a demo
      </button>
      <DemoRequestModal
        open={open}
        onClose={() => {
          setOpen(false)
        }}
        onSubmitted={() => {
          setDismissed(true)
          writeDismissed()
        }}
      />
    </>
  )
}

export default DemoRequestFunnel
