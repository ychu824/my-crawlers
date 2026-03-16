const fs = require('fs');
const path = require('path');
const logger = require('./logger');

function sanitizeFilePart(input) {
  return String(input || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}

/**
 * Append a crawl result to a daily rolling JSON file.
 *
 * File naming: `YYYY-MM-DD-<item-slug>.json`
 * Each file contains a JSON array of run entries for that item on that day.
 * This keeps one file per item per day instead of one file per run.
 */
function saveRunSnapshot(item, results, resultsDir) {
  try {
    fs.mkdirSync(resultsDir, { recursive: true });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const itemSlug = sanitizeFilePart(item.name);
    const fileName = `${dateStr}-${itemSlug}.json`;
    const filePath = path.join(resultsDir, fileName);

    const entry = {
      timestamp: now.toISOString(),
      item: item.name,
      crawlerConfig: item.crawlerConfig,
      search: item.search || null,
      brand: item.brand || null,
      count: Array.isArray(results) ? results.length : 0,
      results: Array.isArray(results) ? results : [],
    };

    // read existing daily file or start a new array
    let runs = [];
    if (fs.existsSync(filePath)) {
      try {
        runs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!Array.isArray(runs)) runs = [];
      } catch {
        // corrupted file — start fresh
        logger.warn('Corrupted snapshot file, starting fresh', { filePath });
        runs = [];
      }
    }

    runs.push(entry);
    fs.writeFileSync(filePath, JSON.stringify(runs, null, 2));
    logger.info('Saved crawl snapshot', {
      item: item.name,
      filePath,
      count: entry.count,
      runsToday: runs.length,
    });
  } catch (e) {
    logger.error('Failed to save crawl snapshot', { item: item.name, error: e.message });
  }
}

module.exports = { saveRunSnapshot };
