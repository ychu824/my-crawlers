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

function saveRunSnapshot(item, results, resultsDir) {
  try {
    fs.mkdirSync(resultsDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:]/g, '-');
    const itemSlug = sanitizeFilePart(item.name);
    const fileName = `${ts}-${itemSlug}.json`;
    const filePath = path.join(resultsDir, fileName);
    const payload = {
      timestamp: new Date().toISOString(),
      item: item.name,
      crawlerConfig: item.crawlerConfig,
      search: item.search || null,
      brand: item.brand || null,
      count: Array.isArray(results) ? results.length : 0,
      results: Array.isArray(results) ? results : [],
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
    logger.info('Saved crawl snapshot', { item: item.name, filePath, count: payload.count });
  } catch (e) {
    logger.error('Failed to save crawl snapshot', { item: item.name, error: e.message });
  }
}

module.exports = { saveRunSnapshot };
