#!/usr/bin/env node
// One-shot script: backfills appointment-events.json from existing snapshots,
// recording only no→yes transitions (i.e. when a slot was newly released).
// Usage: node tracker/backfill-history.js [--days N]   (default: 3)
// Run from the repo root.

const fs   = require('fs');
const path = require('path');
const { appendEvent, HISTORY_FILENAME } = require('./appointment-history');
const { parseAppointmentMessage }       = require('./processor');

const args    = process.argv.slice(2);
const daysIdx = args.indexOf('--days');
const days    = daysIdx !== -1 ? parseInt(args[daysIdx + 1], 10) : 3;

const resultsDir = process.env.TRACKER_RESULTS_DIR
  || path.join(__dirname, '..', 'output', 'tracker');

if (!fs.existsSync(resultsDir)) {
  console.error(`resultsDir not found: ${resultsDir}`);
  process.exit(1);
}

// Load all snapshot files, sorted oldest→newest by their earliest timestamp.
const files = fs.readdirSync(resultsDir)
  .filter(f => f.endsWith('.json') && f !== HISTORY_FILENAME)
  .map(f => {
    const fp = path.join(resultsDir, f);
    try {
      const entries = JSON.parse(fs.readFileSync(fp, 'utf8'));
      if (!Array.isArray(entries) || !entries[0]?.timestamp) return null;
      return { fp, entries, ts: new Date(entries[0].timestamp).getTime() };
    } catch { return null; }
  })
  .filter(Boolean)
  .sort((a, b) => a.ts - b.ts);

const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

// Replay snapshots in order, tracking last known status per item.
const lastStatus = {};  // item name → 'yes' | 'no'
let harvested = 0;

for (const { entries } of files) {
  for (const entry of entries) {
    if (!Array.isArray(entry.results) || !entry.timestamp) continue;
    const ts = new Date(entry.timestamp).getTime();
    const result = entry.results[0] || {};
    const available = (result.appointments_available || '').toLowerCase();
    const isAvailable = available === 'yes' || available === 'unknown';
    const wasAvailable = lastStatus[entry.item] === 'yes';

    if (isAvailable && !wasAvailable) {
      // Transition detected — only record if within the requested window
      if (ts >= cutoff) {
        const message = parseAppointmentMessage(result.message || '');
        appendEvent(resultsDir, {
          item:      entry.item,
          timestamp: entry.timestamp,
          message,
        });
        console.log(`  + [${entry.timestamp}] ${entry.item} — ${message}`);
        harvested++;
      }
    }

    lastStatus[entry.item] = isAvailable ? 'yes' : 'no';
  }
}

console.log(`\nDone. Harvested ${harvested} transition event(s) from past ${days} day(s).`);
