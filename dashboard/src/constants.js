export const ITEMS = [
  { key: 'cpl', label: 'CPL', full: 'Concealed Pistol License', color: '#1677ff' },
  { key: 'afl', label: 'AFL', full: 'Alien Firearm License',    color: '#722ed1' },
];

export const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`
);
