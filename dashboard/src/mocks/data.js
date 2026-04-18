// Deterministic mock data — all timestamps are relative to "now" so charts
// always show populated data regardless of when you run the dev server.

const CPL = 'King County CPL Appointments';
const AFL = 'King County AFL Appointments';

// [daysAgo, itemName, releaseHour, appointmentSlots[]]
// Pattern: appointments tend to open Mon/Wed/Fri mornings or Tuesday afternoons
const SCHEDULE = [
  [1,   AFL, 9,  ['9:00 AM', '10:30 AM', '2:00 PM']],
  [3,   CPL, 10, ['10:00 AM', '11:30 AM']],
  [5,   AFL, 14, ['2:00 PM', '3:30 PM']],
  [7,   CPL, 9,  ['9:00 AM']],
  [8,   AFL, 10, ['10:00 AM', '11:00 AM', '2:00 PM']],
  [10,  CPL, 13, ['1:00 PM', '2:30 PM']],
  [12,  AFL, 9,  ['9:30 AM', '10:00 AM']],
  [14,  CPL, 10, ['10:00 AM', '11:00 AM', '1:00 PM']],
  [15,  AFL, 14, ['2:00 PM']],
  [17,  CPL, 9,  ['9:00 AM', '10:30 AM']],
  [19,  AFL, 10, ['10:00 AM', '11:30 AM', '2:00 PM']],
  [21,  CPL, 13, ['1:00 PM', '3:00 PM']],
  [22,  AFL, 9,  ['9:00 AM']],
  [24,  CPL, 10, ['10:00 AM', '11:00 AM']],
  [26,  AFL, 14, ['2:00 PM', '3:30 PM', '4:00 PM']],
  [28,  CPL, 9,  ['9:30 AM', '10:00 AM']],
  [30,  AFL, 10, ['10:00 AM', '2:00 PM']],
  [35,  CPL, 9,  ['9:00 AM', '10:30 AM']],
  [40,  AFL, 14, ['2:00 PM', '3:00 PM']],
  [45,  CPL, 10, ['10:00 AM']],
  [50,  AFL, 9,  ['9:00 AM', '11:00 AM']],
  [55,  CPL, 13, ['1:00 PM', '2:30 PM']],
  [60,  AFL, 10, ['10:00 AM', '11:30 AM']],
  [70,  CPL, 9,  ['9:00 AM']],
  [80,  AFL, 14, ['2:00 PM', '4:00 PM']],
  [90,  CPL, 10, ['10:00 AM', '11:00 AM', '1:00 PM']],
  [100, AFL, 9,  ['9:30 AM', '10:00 AM']],
  [110, CPL, 13, ['1:00 PM']],
  [120, AFL, 10, ['10:00 AM', '2:00 PM']],
  [150, CPL, 9,  ['9:00 AM', '10:30 AM']],
  [180, AFL, 14, ['2:00 PM', '3:30 PM']],
  [210, CPL, 10, ['10:00 AM']],
  [240, AFL, 9,  ['9:00 AM', '11:00 AM']],
  [270, CPL, 13, ['1:00 PM', '2:30 PM']],
  [300, AFL, 10, ['10:00 AM', '11:30 AM']],
  [330, CPL, 9,  ['9:00 AM']],
  [360, AFL, 14, ['2:00 PM']],
];

function buildTimestamp(daysAgo, hour) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export const MOCK_EVENTS = SCHEDULE.map(([daysAgo, item, releaseHour, slots]) => {
  const timestamp = buildTimestamp(daysAgo, releaseHour);
  const dt = new Date(timestamp);
  const dateStr = dt.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  return {
    item,
    timestamp,
    message: `${dateStr}: ${slots.join(', ')}`,
    slots,
    releaseHour,
    releaseDayOfWeek: dt.getDay(),
  };
});

export const MOCK_STATUS = {
  configPath: 'tracker/config.json (mock)',
  state: {
    [CPL]: {
      lastStatus: 'no',
      lastMessage: 'Sorry, no appointments are currently available.',
      lastChecked: buildTimestamp(0, new Date().getHours()),
    },
    [AFL]: {
      lastStatus: 'yes',
      lastMessage: `${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}: 9:00 AM, 10:30 AM, 2:00 PM`,
      lastChecked: buildTimestamp(0, new Date().getHours()),
    },
  },
};
