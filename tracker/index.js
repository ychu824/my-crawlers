const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const cron = require('node-cron');
const express = require('express');
const logger = require('./logger');
const { sendEmail } = require('./email');

const defaultConfigPath = path.join(__dirname, 'config.json');
const localConfigPath = path.join(__dirname, 'config.local.json');
const statePath = path.join(__dirname, 'state.json');
const resultsDir = process.env.TRACKER_RESULTS_DIR || path.join(__dirname, '..', 'output', 'tracker');

let config = [];
let state = {};
let activeConfigPath = process.env.TRACKER_CONFIG || (fs.existsSync(localConfigPath) ? localConfigPath : defaultConfigPath);

function loadFiles() {
  try {
    activeConfigPath = process.env.TRACKER_CONFIG || (fs.existsSync(localConfigPath) ? localConfigPath : defaultConfigPath);
    config = JSON.parse(fs.readFileSync(activeConfigPath));
    logger.info('Loaded tracker config', { configPath: activeConfigPath, itemCount: Array.isArray(config) ? config.length : 0 });
  } catch (e) {
    logger.error('Unable to read tracker config', { configPath: activeConfigPath, error: e.message });
    process.exit(1);
  }
  try {
    state = JSON.parse(fs.readFileSync(statePath));
  } catch {
    state = {};
  }
}

function saveState() {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function sanitizeFilePart(input) {
  return String(input || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}

function saveRunSnapshot(item, results) {
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

function runCrawler(item) {
  return new Promise((resolve, reject) => {
    const args = ['main.py', '--config', item.crawlerConfig, '--json-only'];
    if (item.search) args.push('--search', item.search);
    if (item.brand) args.push('--brand', item.brand);
    // prefer explicit env override, otherwise default to `python3` on PATH
    // this ensures a Linux deployment uses the system interpreter instead of
    // Homebrew's Mac path.  During local macOS debugging the virtualenv is
    // still honored if present.
    let py = process.env.PYTHON || 'python3';
    const venvPath = path.join(__dirname, '..', 'venv', 'bin', 'python');
    if (fs.existsSync(venvPath)) {
      py = venvPath;
    }
    const cmd = `${py} ${args.map(a => `'${a}'`).join(' ')}`;
    logger.info('Running crawler', { cmd });
    exec(cmd, { cwd: path.join(__dirname, '..'), timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        // log but continue if there is stdout content
        logger.error('Crawler execution error', { error: err.message, stderr, stdout });
      }
      try {
        const results = stdout ? JSON.parse(stdout) : [];
        resolve(results);
      } catch (e) {
        logger.error('Failed to parse crawler output', { error: e.message, stdout });
        // still resolve with empty array
        resolve([]);
      }
    });
  });
}

function processItem(item, results) {
  // find lowest price found
  let currentPrice = null;
  results.forEach(r => {
    if (r.price) {
      const m = r.price.replace(/[^0-9\.]/g, '');
      const p = parseFloat(m);
      if (!isNaN(p) && (currentPrice === null || p < currentPrice)) {
        currentPrice = p;
      }
    }
  });
  const stateEntry = state[item.name] || {};
  if (currentPrice !== null) {
    if (!stateEntry.lastPrice || currentPrice < stateEntry.lastPrice) {
      // price drop or new
      logger.info('Price drop detected', { item: item.name, old: stateEntry.lastPrice, new: currentPrice });
      if (process.env.NOTIFY_EMAIL) {
        sendEmail(process.env.NOTIFY_EMAIL,
          `Price alert: ${item.name}`,
          `${item.name} price dropped from ${stateEntry.lastPrice || 'N/A'} to ${currentPrice}.`);
      }
    }
    state[item.name] = { lastPrice: currentPrice, lastChecked: new Date().toISOString() };
  }
}

async function checkAll() {
  logger.info('Starting scheduled check');
  loadFiles();
  for (const item of config) {
    try {
      const results = await runCrawler(item);
      saveRunSnapshot(item, results);
      processItem(item, results);
    } catch (e) {
      logger.error('Error processing item', { item: item.name, error: e.message });
    }
  }
  saveState();
  logger.info('Scheduled check complete');
}

// schedule every hour by default
cron.schedule('0 * * * *', checkAll);

// minimal HTTP server for logs/status
const app = express();
app.get('/status', (req, res) => {
  res.json({ config, configPath: activeConfigPath, state, lastRun: state._lastRun });
});
app.get('/logs', (req, res) => {
  const since = req.query.since;
  const logFile = path.join(__dirname, 'logs', 'tracker.log');
  if (!fs.existsSync(logFile)) {
    return res.json([]);
  }
  const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(l => l.trim());
  if (since) {
    const d = new Date(since);
    return res.json(lines.filter(l => {
      try {
        const o = JSON.parse(l);
        return new Date(o.timestamp) >= d;
      } catch { return false; }
    }));
  }
  res.json(lines);
});

const port = process.env.TRACKER_PORT || 3001;
app.listen(port, () => {
  logger.info('Tracker HTTP API listening', { port });
});

// run immediately on startup
checkAll();
