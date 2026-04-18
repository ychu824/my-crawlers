const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { appendEvent, HISTORY_FILENAME } = require('./appointment-history');

const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS, 10) || 3;

// Before deleting an expiring snapshot, extract any "available" appointment
// events into the long-term history log so trend data isn't lost.
function harvestAppointmentEvents(filePath, resultsDir) {
  try {
    const entries = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const entry of entries) {
      if (!Array.isArray(entry.results)) continue;
      for (const result of entry.results) {
        if (result.appointments_available === 'yes') {
          appendEvent(resultsDir, {
            item: entry.item,
            timestamp: entry.timestamp,
            message: result.message || '',
          });
        }
      }
    }
  } catch (e) {
    logger.error('Failed to harvest appointment events from snapshot', {
      file: filePath,
      error: e.message,
    });
  }
}

function gcLogs(resultsDir) {
  const cutoff = new Date(Date.now() - LOG_RETENTION_DAYS * 86400000);
  logger.info('Running log GC', { retentionDays: LOG_RETENTION_DAYS, cutoff: cutoff.toISOString() });

  // 1. Trim tracker.log — keep only lines newer than cutoff
  const logFile = path.join(__dirname, 'logs', 'tracker.log');
  if (fs.existsSync(logFile)) {
    try {
      const lines = fs.readFileSync(logFile, 'utf8').split('\n');
      const kept = lines.filter(l => {
        if (!l.trim()) return false;
        try {
          return new Date(JSON.parse(l).timestamp) >= cutoff;
        } catch { return false; }
      });
      fs.writeFileSync(logFile, kept.join('\n') + (kept.length ? '\n' : ''));
      logger.info('Trimmed tracker.log', { before: lines.length, after: kept.length });
    } catch (e) {
      logger.error('Failed to GC tracker.log', { error: e.message });
    }
  }

  // 2. Remove old snapshot files, harvesting appointment events first
  if (fs.existsSync(resultsDir)) {
    try {
      const files = fs.readdirSync(resultsDir);
      let removed = 0;
      for (const f of files) {
        // Never delete the long-term appointment events log
        if (f === HISTORY_FILENAME) continue;

        const fp = path.join(resultsDir, f);
        const stat = fs.statSync(fp);
        if (stat.isFile() && stat.mtime < cutoff) {
          harvestAppointmentEvents(fp, resultsDir);
          fs.unlinkSync(fp);
          removed++;
        }
      }
      if (removed > 0) {
        logger.info('Removed old snapshots', { removed });
      }
    } catch (e) {
      logger.error('Failed to GC snapshots', { error: e.message });
    }
  }
}

module.exports = { gcLogs };
