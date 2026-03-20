const fs = require('fs');
const path = require('path');
const express = require('express');
const logger = require('./logger');

function createApp(getStatus, reloadEnv, runGc) {
  const app = express();

  app.get('/status', (req, res) => {
    res.json(getStatus());
  });

  app.post('/reload-env', (req, res) => {
    if (reloadEnv) {
      reloadEnv();
      res.json({ ok: true, message: 'Environment variables reloaded from .env' });
    } else {
      res.status(501).json({ ok: false, message: 'Hot-reload not available' });
    }
  });

  app.post('/gc', (req, res) => {
    if (runGc) {
      runGc();
      res.json({ ok: true, message: 'GC triggered' });
    } else {
      res.status(501).json({ ok: false, message: 'GC not available' });
    }
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
