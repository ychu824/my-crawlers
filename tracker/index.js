const envPath = require('path').resolve(__dirname, '..', '.env');
require('dotenv').config({ path: envPath });
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const dotenv = require('dotenv');
const logger = require('./logger');
const { runCrawler } = require('./crawler');
const { processItem } = require('./processor');
const { saveRunSnapshot } = require('./snapshot');
const { gcLogs } = require('./gc');
const { createApp, startServer } = require('./api');

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

async function checkAll() {
  logger.info('Starting scheduled check');
  loadFiles();
  for (const item of config) {
    try {
      const results = await runCrawler(item);
      saveRunSnapshot(item, results, resultsDir);
      processItem(item, results, state, resultsDir);
    } catch (e) {
      logger.error('Error processing item', { item: item.name, error: e.message });
    }
  }
  saveState();
  logger.info('Scheduled check complete');
}

// schedule crawl — default every 10 minutes, configurable via TRACKER_CRON
const crawlCron = process.env.TRACKER_CRON || '*/10 * * * *';
logger.info('Scheduling crawl', { cron: crawlCron });
cron.schedule(crawlCron, checkAll);

// run GC once a day at 3:00 AM
const gcCron = process.env.TRACKER_GC_CRON || '0 3 * * *';
cron.schedule(gcCron, () => gcLogs(resultsDir));

// ── .env hot-reload ──────────────────────────────────────────────
function reloadEnv() {
  try {
    const parsed = dotenv.parse(fs.readFileSync(envPath));
    // update process.env with new values (existing shell vars still win)
    for (const [key, value] of Object.entries(parsed)) {
      process.env[key] = value;
    }
    logger.info('Reloaded .env', { path: envPath, keys: Object.keys(parsed) });
  } catch (e) {
    logger.error('Failed to reload .env', { error: e.message });
  }
}

// watch .env for changes and auto-reload
if (fs.existsSync(envPath)) {
  fs.watch(envPath, (eventType) => {
    if (eventType === 'change') {
      logger.info('.env file changed, reloading environment variables');
      reloadEnv();
    }
  });
}

// HTTP API
const app = createApp(
  () => ({ config, configPath: activeConfigPath, state, lastRun: state._lastRun }),
  reloadEnv,
  () => gcLogs(resultsDir),
  resultsDir
);
startServer(app);

// run immediately on startup
checkAll();
