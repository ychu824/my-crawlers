import React, { useState } from 'react';
import { Card, Input, Button, Alert, Typography, Space } from 'antd';

const { Title, Paragraph } = Typography;

export default function SubscribeForm() {
  const [email,  setEmail]  = useState('');
  const [busy,   setBusy]   = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit() {
    if (!email.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res  = await fetch('/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setResult({ type: 'error', message: data.message || 'Something went wrong.' });
      } else if (data.already) {
        setResult({ type: 'info', message: 'This email is already subscribed.' });
      } else {
        setResult({ type: 'success', message: 'Check your inbox for a confirmation link.' });
        setEmail('');
      }
    } catch {
      setResult({ type: 'error', message: 'Request failed. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Title level={5} style={{ marginTop: 0 }}>
        🔔 Get notified when appointments open
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Enter your email and we'll send a confirmation link. You'll get an alert the
        moment CPL or AFL slots become available.
      </Paragraph>
      <Space.Compact style={{ width: '100%', maxWidth: 440 }}>
        <Input
          placeholder="your@email.com"
          type="email"
          value={email}
          size="large"
          onChange={(e) => setEmail(e.target.value)}
          onPressEnter={handleSubmit}
        />
        <Button type="primary" size="large" loading={busy} onClick={handleSubmit}>
          Subscribe
        </Button>
      </Space.Compact>
      {result && (
        <Alert
          type={result.type}
          message={result.message}
          showIcon
          closable
          style={{ marginTop: 14, maxWidth: 440 }}
          onClose={() => setResult(null)}
        />
      )}
    </Card>
  );
}
