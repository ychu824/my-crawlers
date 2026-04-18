import React, { useMemo } from 'react';
import { Scatter } from 'react-chartjs-2';
import { Typography } from 'antd';
import './chartSetup.js';
import { ITEMS } from '../../constants';

const { Text } = Typography;

function parseApptDate(message) {
  if (!message) return null;
  // Matches e.g. "Wednesday July 15, 2026: 11:45 AM" or "July 15 2026 11:45 AM"
  const m = message.match(/(?:\w+\s+)?(\w+\s+\d{1,2},?\s*\d{4})[:\s]+(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  if (!m) return null;
  const d = new Date(`${m[1]} ${m[2]}`);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(ms) {
  return new Date(ms).toLocaleDateString('default', { month: 'short', day: 'numeric' });
}
function fmtFull(ms) {
  return new Date(ms).toLocaleString('default', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function AppointmentDatesChart({ events }) {
  const datasets = useMemo(() => ITEMS.map(item => ({
    label: item.full,
    backgroundColor: item.color + 'cc',
    borderColor: item.color,
    pointRadius: 9,
    pointHoverRadius: 12,
    data: events
      .filter(e => e.item.toLowerCase().includes(item.key))
      .flatMap(e => {
        const appt = parseApptDate(e.message);
        if (!appt) return [];
        return [{ x: new Date(e.timestamp).getTime(), y: appt.getTime(), e }];
      }),
  })), [events]);

  const hasData = datasets.some(d => d.data.length > 0);

  if (!hasData) {
    return (
      <div className="empty-chart">
        <span style={{ fontSize: 32 }}>📭</span>
        <Text type="secondary">No historical data yet — trends appear after appointments are detected</Text>
      </div>
    );
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          title: () => '',
          label: ctx => {
            const { x, y, e } = ctx.raw;
            return [
              `${ctx.dataset.label}`,
              `Released:    ${fmtFull(x)}`,
              `Appointment: ${fmtFull(y)}`,
              e.message ? `Details: ${e.message}` : '',
            ].filter(Boolean);
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        title: { display: true, text: 'Released on' },
        ticks: { callback: v => fmtDate(v) },
      },
      y: {
        type: 'linear',
        title: { display: true, text: 'Appointment date' },
        ticks: { callback: v => fmtDate(v) },
      },
    },
  };

  return (
    <div className="chart-wrap">
      <Scatter data={{ datasets }} options={options} />
    </div>
  );
}
