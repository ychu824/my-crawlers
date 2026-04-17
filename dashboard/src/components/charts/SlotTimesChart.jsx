import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Typography } from 'antd';
import './chartSetup.js';
import { ITEMS } from '../../constants';

const { Text } = Typography;

const OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top' }, tooltip: { mode: 'index' } },
  scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } },
};

function slotToMinutes(slot) {
  const [time, period] = slot.split(' ');
  const [h, m] = time.split(':').map(Number);
  const hour = period === 'PM' && h !== 12 ? h + 12 : period === 'AM' && h === 12 ? 0 : h;
  return hour * 60 + m;
}

export default function SlotTimesChart({ events }) {
  const { labels, datasets } = useMemo(() => {
    const allSlots = [
      ...new Set(events.flatMap((e) => e.slots || [])),
    ].sort((a, b) => slotToMinutes(a) - slotToMinutes(b));

    const datasets = ITEMS.map((item) => ({
      label: item.full,
      data: allSlots.map(
        (slot) =>
          events.filter(
            (e) => e.item.toLowerCase().includes(item.key) && (e.slots || []).includes(slot)
          ).length
      ),
      backgroundColor: item.color + 'bb',
      borderColor: item.color,
      borderWidth: 1,
      borderRadius: 4,
    }));

    return { labels: allSlots, datasets };
  }, [events]);

  if (!events.length || !labels.length) {
    return (
      <div className="empty-chart">
        <span style={{ fontSize: 32 }}>🗓</span>
        <Text type="secondary">No appointment slot data yet</Text>
      </div>
    );
  }

  return (
    <div className="chart-wrap">
      <Bar data={{ labels, datasets }} options={OPTIONS} />
    </div>
  );
}
