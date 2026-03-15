const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const logger = require('./logger');

function runCrawler(item) {
  return new Promise((resolve, reject) => {
    const args = ['main.py', '--config', item.crawlerConfig, '--json-only'];
    if (item.search) args.push('--search', item.search);
    if (item.brand) args.push('--brand', item.brand);
    if (item.score !== false) args.push('--score');
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

module.exports = { runCrawler };
