#!/usr/bin/env node
// One-shot script: reads existing snapshots and backfills appointment-events.json.
// Usage: node tracker/backfill-history.js [--days N]   (default: 3)
// Run from the repo root.

const fs   = require('fs');
const path = require('path');
const { appendEvent, HISTORY_FILENAME } = require('./appointment-history');

const args    = process.argv.slice(2);
const daysIdx = args.indexOf('--days');
const days    = daysIdx !== -1 ? parseInt(args[daysIdx + 1], 10) : 3;

const resultsDir = process.env.TRACKER_RESULTS_DIR
  || path.join(__dirname, '..', 'output', 'tracker');

const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

if (!fs.existsSync(resultsDir)) {
  console.error(`resultsDir not found: ${resultsDir}`);
  process.exit(1);
}

const files = fs.readdirSync(resultsDir)
  .filter(f => f.endsWith('.json') && f !== HISTORY_FILENAME)
  .map(f => ({ f, fp: path.join(resultsDir, f) }));

let harvested = 0;
let skipped   = 0;

for (const { f, fp } of files) {
  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    console.warn(`  skip (parse error): ${f}`);
    skipped++;
    continue;
  }

  if (!Array.isArray(entries)) { skipped++; continue; }

  for (const entry of entries) {
    if (!Array.isArray(entry.results)) continue;
    const ts = entry.timestamp;
    if (!ts || new Date(ts).getTime() < cutoff) continue;

    for (const result of entry.results) {
      if (result.appointments_available === 'yes') {
        appendEvent(resultsDir, {
          item:      entry.item,
          timestamp: ts,
          message:   result.message || '',
        });
        harvested++;
        console.log(`  + [${ts}] ${entry.item}`);
      }
    }
  }
}

console.log(`\nDone. Harvested ${harvested} event(s) from past ${days} day(s). Skipped ${skipped} file(s).`);
