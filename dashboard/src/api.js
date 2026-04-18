import { MOCK_EVENTS, MOCK_STATUS } from './mocks/data';

export const IS_MOCK = import.meta.env.DEV;

export async function fetchStatus() {
  if (IS_MOCK) return MOCK_STATUS;
  const res = await fetch('/status');
  if (!res.ok) throw new Error(`/status ${res.status}`);
  return res.json();
}

export async function fetchHistory(range) {
  if (IS_MOCK) {
    const cutoffDays = range === 'year' ? 365 : 30;
    const cutoff = Date.now() - cutoffDays * 86400000;
    return { events: MOCK_EVENTS.filter(e => new Date(e.timestamp).getTime() >= cutoff) };
  }
  const res = await fetch(`/appointment-history?range=${range}`);
  if (!res.ok) throw new Error(`/appointment-history ${res.status}`);
  return res.json();
}

export async function subscribe(email) {
  if (IS_MOCK) {
    await new Promise(r => setTimeout(r, 600)); // simulate network delay
    return { ok: true, message: 'Confirmation email sent. (mock — no email actually sent)' };
  }
  const res = await fetch('/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.json();
}
