import React from 'react';
import { Card, Space, Tag, Typography } from 'antd';

const { Text } = Typography;

export default function StatusCard({ item, stateEntry }) {
  const raw   = stateEntry?.lastStatus || '';
  const isYes = raw === 'yes';
  const isNo  = raw === 'no';

  const dotClass = isYes ? 'available' : isNo ? 'unavailable' : 'unknown';
  const tagColor = isYes ? 'success' : isNo ? 'error' : 'default';
  const tagText  = isYes ? 'AVAILABLE' : isNo ? 'UNAVAILABLE' : 'UNKNOWN';

  return (
    <Card
      style={{ borderTop: `3px solid ${item.color}`, height: '100%' }}
      styles={{ body: { padding: '20px 24px' } }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <Space align="center">
          <span className={`status-dot ${dotClass}`} />
          <Text strong style={{ fontSize: 15 }}>{item.full}</Text>
          <Tag style={{ marginLeft: 'auto' }}>{item.label}</Tag>
        </Space>

        <Tag color={tagColor} style={{ fontSize: 13, padding: '2px 10px' }}>
          {tagText}
        </Tag>

        {stateEntry?.lastMessage && (
          <Text type="secondary" style={{ fontSize: 13 }}>
            {stateEntry.lastMessage}
          </Text>
        )}

        {stateEntry?.lastChecked && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            Last checked: {new Date(stateEntry.lastChecked).toLocaleString()}
          </Text>
        )}

        {!stateEntry && (
          <Text type="secondary" style={{ fontSize: 13 }}>Not checked yet</Text>
        )}
      </Space>
    </Card>
  );
}
