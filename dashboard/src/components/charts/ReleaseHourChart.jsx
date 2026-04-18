import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Typography } from 'antd';
import './chartSetup.js';
import { ITEMS, HOUR_LABELS } from '../../constants';

const { Text } = Typography;

const OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top' }, tooltip: { mode: 'index' } },
  scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } },
};

export default function ReleaseHourChart({ events }) {
  const datasets = useMemo(
    () =>
      ITEMS.map((item) => {
        const counts = Array(24).fill(0);
        events
          .filter((e) => e.item.toLowerCase().includes(item.key))
          .forEach((e) => { if (e.releaseHour != null) counts[e.releaseHour]++; });
        return {
          label: item.full,
          data: counts,
          backgroundColor: item.color + 'bb',
          borderColor: item.color,
          borderWidth: 1,
          borderRadius: 4,
        };
      }),
    [events]
  );

  if (!events.length) {
    return (
      <div className="empty-chart">
        <span style={{ fontSize: 32 }}>🕐</span>
        <Text type="secondary">No release hour data yet</Text>
      </div>
    );
  }

  return (
    <div className="chart-wrap">
      <Bar data={{ labels: HOUR_LABELS, datasets }} options={OPTIONS} />
    </div>
  );
}
