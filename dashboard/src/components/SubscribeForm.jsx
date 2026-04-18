import React, { useState } from 'react';
import { Card, Input, Button, Alert, Typography } from 'antd';
import { subscribe, IS_MOCK } from '../api';

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
      const data = await subscribe(email.trim());
      if (!data.ok) {
        setResult({ type: 'error', message: data.message || 'Something went wrong.' });
      } else if (data.already) {
        setResult({ type: 'info', message: 'This email is already subscribed.' });
      } else {
        setResult({ type: 'success', message: data.message || 'Check your inbox for a confirmation link.' });
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
        {IS_MOCK
          ? 'Subscribe form works in mock mode — no emails will actually be sent.'
          : "Enter your email and we'll send a confirmation link. You'll get an alert the moment CPL or AFL slots become available."}
      </Paragraph>
      <Input.Search
        placeholder="your@email.com"
        enterButton="Subscribe"
        size="large"
        type="email"
        value={email}
        loading={busy}
        style={{ maxWidth: 440 }}
        onChange={e => setEmail(e.target.value)}
        onSearch={handleSubmit}
      />
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
