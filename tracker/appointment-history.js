const fs = require('fs');
const path = require('path');

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const HISTORY_FILENAME = 'appointment-events.json';

function historyFilePath(resultsDir) {
  return path.join(resultsDir, HISTORY_FILENAME);
}

function loadEvents(resultsDir) {
  const fp = historyFilePath(resultsDir);
  if (!fs.existsSync(fp)) return [];
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return [];
  }
}

function saveEvents(resultsDir, events) {
  const fp = historyFilePath(resultsDir);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(events, null, 2));
}

function parseSlots(message) {
  if (!message) return [];
  return (message.match(/\d+:\d+\s*(?:AM|PM)/gi) || [])
    .map(s => s.trim().toUpperCase());
}

function appendEvent(resultsDir, { item, timestamp, message }) {
  const ts = timestamp || new Date().toISOString();
  const dt = new Date(ts);
  const event = {
    item,
    timestamp: ts,
    message: message || '',
    slots: parseSlots(message),
    releaseHour: dt.getHours(),
    releaseDayOfWeek: dt.getDay(),
  };

  let events = loadEvents(resultsDir);
  // Skip duplicates (same item + timestamp)
  if (events.some(e => e.item === item && e.timestamp === ts)) return;
  events.push(event);

  // Prune to 1 year
  const cutoff = Date.now() - ONE_YEAR_MS;
  events = events.filter(e => new Date(e.timestamp).getTime() >= cutoff);
  saveEvents(resultsDir, events);
}

function queryEvents(resultsDir, { item, since } = {}) {
  let events = loadEvents(resultsDir);
  if (item) {
    const q = item.toLowerCase();
    events = events.filter(e => e.item.toLowerCase().includes(q));
  }
  if (since) {
    const d = new Date(since);
    events = events.filter(e => new Date(e.timestamp) >= d);
  }
  return events;
}

module.exports = { appendEvent, queryEvents, parseSlots, HISTORY_FILENAME };
