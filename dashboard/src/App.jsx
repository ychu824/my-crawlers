import React, { useState, useEffect, useCallback } from 'react';
import {
  ConfigProvider, Row, Col, Card, Tabs, Select, Button,
  Statistic, Typography, Space, Spin, Alert, message as antdMessage,
} from 'antd';
import { ReloadOutlined, ExperimentOutlined } from '@ant-design/icons';
import StatusCard from './components/StatusCard';
import SubscribeForm from './components/SubscribeForm';
import TimelineChart from './components/charts/TimelineChart';
import ReleaseHourChart from './components/charts/ReleaseHourChart';
import SlotTimesChart from './components/charts/SlotTimesChart';
import { ITEMS } from './constants';
import { IS_MOCK, fetchStatus, fetchHistory } from './api';

const { Text } = Typography;

export default function App() {
  const [status,    setStatus]    = useState(null);
  const [events,    setEvents]    = useState([]);
  const [range,     setRange]     = useState('month');
  const [loading,   setLoading]   = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [msgApi, ctx] = antdMessage.useMessage();

  const fetchAll = useCallback(async (r = range) => {
    setLoading(true);
    try {
      const [s, h] = await Promise.all([fetchStatus(), fetchHistory(r)]);
      setStatus(s);
      setEvents(h.events || []);
      setLastFetch(new Date());
    } catch {
      msgApi.error('Failed to load data from tracker');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchAll(range); }, [range]);

  function stateFor(itemKey) {
    if (!status?.state) return null;
    const key = Object.keys(status.state).find(k => k.toLowerCase().includes(itemKey));
    return key ? status.state[key] : null;
  }

  const cplCount = events.filter(e => e.item.toLowerCase().includes('cpl')).length;
  const aflCount = events.filter(e => e.item.toLowerCase().includes('afl')).length;

  const tabItems = [
    { key: 'timeline', label: '📅 Availability Timeline', children: <TimelineChart events={events} range={range} /> },
    { key: 'hours',    label: '🕐 Release Hours',          children: <ReleaseHourChart events={events} /> },
    { key: 'slots',    label: '🗓 Appointment Slots',      children: <SlotTimesChart events={events} /> },
  ];

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1677ff' } }}>
      {ctx}

      <div className="page-header">
        <h1>🔔 King County Appointment Tracker</h1>
        <span className="last-updated">
          {lastFetch ? `Updated ${lastFetch.toLocaleTimeString()}` : ''}
        </span>
      </div>

      <div className="content">
        {IS_MOCK && (
          <Alert
            icon={<ExperimentOutlined />}
            message="Mock mode — showing sample data. Run npm run dev:vm (with tunnel) for live VM data."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Spin spinning={loading} tip="Loading…" size="large">

          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            {ITEMS.map(item => (
              <Col xs={24} sm={12} key={item.key}>
                <StatusCard item={item} stateEntry={stateFor(item.key)} />
              </Col>
            ))}
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            {[
              { title: 'Total events', value: events.length, suffix: range === 'month' ? 'this month' : 'this year' },
              { title: 'CPL events', value: cplCount, color: ITEMS[0].color },
              { title: 'AFL events', value: aflCount, color: ITEMS[1].color },
            ].map((s, i) => (
              <Col xs={24} sm={8} key={i}>
                <Card styles={{ body: { padding: '16px 20px' } }}>
                  <Statistic
                    title={s.title}
                    value={s.value}
                    suffix={s.suffix}
                    valueStyle={s.color ? { color: s.color } : undefined}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          <Card
            title={<Text strong>Appointment Trends</Text>}
            style={{ marginBottom: 16 }}
            extra={
              <Space>
                <Select
                  value={range}
                  onChange={setRange}
                  options={[
                    { value: 'month', label: 'Past 30 days' },
                    { value: 'year',  label: 'Past year' },
                  ]}
                  style={{ width: 140 }}
                />
                <Button icon={<ReloadOutlined />} size="small" onClick={() => fetchAll(range)}>
                  Refresh
                </Button>
              </Space>
            }
          >
            <Tabs items={tabItems} />
          </Card>

          <SubscribeForm />

        </Spin>
      </div>

      <div className="footer">
        {IS_MOCK ? 'Mock mode' : 'Tracker checks every 10 minutes'} · Data retained for 1 year
      </div>
    </ConfigProvider>
  );
}
