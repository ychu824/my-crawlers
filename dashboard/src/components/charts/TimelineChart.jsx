import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Typography } from 'antd';
import './chartSetup.js';
import { ITEMS } from '../../constants';

const { Text } = Typography;

const BASE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
  scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } },
};

export default function TimelineChart({ events, range }) {
  const { labels, datasets } = useMemo(() => {
    const now = Date.now();
    const isYear = range === 'year';
    const count = isYear ? 52 : 30;

    const labels = Array.from({ length: count }, (_, i) => {
      const d = new Date(now - (count - 1 - i) * (isYear ? 7 : 1) * 86400000);
      if (isYear) {
        return `${d.toLocaleString('default', { month: 'short' })} W${Math.ceil(d.getDate() / 7)}`;
      }
      return d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
    });

    const bucketIndex = (ts) => {
      const diffMs = now - new Date(ts).getTime();
      const idx = isYear
        ? count - 1 - Math.floor(diffMs / (7 * 86400000))
        : count - 1 - Math.floor(diffMs / 86400000);
      return idx >= 0 && idx < count ? idx : -1;
    };

    const datasets = ITEMS.map((item) => {
      const counts = Array(count).fill(0);
      events
        .filter((e) => e.item.toLowerCase().includes(item.key))
        .forEach((e) => {
          const i = bucketIndex(e.timestamp);
          if (i >= 0) counts[i]++;
        });
      return {
        label: item.full,
        data: counts,
        borderColor: item.color,
        backgroundColor: item.color + '33',
        tension: 0.3,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
      };
    });

    return { labels, datasets };
  }, [events, range]);

  if (!events.length) {
    return (
      <div className="empty-chart">
        <span style={{ fontSize: 32 }}>📭</span>
        <Text type="secondary">No historical data yet — trends appear after appointments are detected</Text>
      </div>
    );
  }

  return (
    <div className="chart-wrap">
      <Line data={{ labels, datasets }} options={BASE_OPTIONS} />
    </div>
  );
}
