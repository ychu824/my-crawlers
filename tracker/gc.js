const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS, 10) || 3;

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

  // 2. Remove old snapshot files from output/tracker/
  if (fs.existsSync(resultsDir)) {
    try {
      const files = fs.readdirSync(resultsDir);
      let removed = 0;
      for (const f of files) {
        const fp = path.join(resultsDir, f);
        const stat = fs.statSync(fp);
        if (stat.isFile() && stat.mtime < cutoff) {
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
