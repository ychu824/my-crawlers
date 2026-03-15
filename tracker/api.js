const fs = require('fs');
const path = require('path');
const express = require('express');
const logger = require('./logger');

function createApp(getStatus) {
  const app = express();

  app.get('/status', (req, res) => {
    res.json(getStatus());
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

  return app;
}

function startServer(app) {
  const port = process.env.TRACKER_PORT || 3001;
  app.listen(port, () => {
    logger.info('Tracker HTTP API listening', { port });
  });
}

module.exports = { createApp, startServer };
