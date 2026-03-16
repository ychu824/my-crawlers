require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
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
      processItem(item, results, state);
    } catch (e) {
      logger.error('Error processing item', { item: item.name, error: e.message });
    }
  }
  saveState();
  logger.info('Scheduled check complete');
}

// schedule every hour by default
cron.schedule('0 * * * *', checkAll);

// run GC once a day at 3:00 AM
cron.schedule('0 3 * * *', () => gcLogs(resultsDir));

// HTTP API
const app = createApp(() => ({ config, configPath: activeConfigPath, state, lastRun: state._lastRun }));
startServer(app);

// run immediately on startup
checkAll();
