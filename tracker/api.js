const fs = require('fs');
const path = require('path');
const express = require('express');
const logger = require('./logger');
const { queryEvents } = require('./appointment-history');
const { addPending, confirm, allSubscribers } = require('./subscribers');
const { sendEmail } = require('./email');

function createApp(getStatus, reloadEnv, runGc, resultsDir) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

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
    if (!fs.existsSync(logFile)) return res.json([]);
    const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(l => l.trim());
    if (since) {
      const d = new Date(since);
      return res.json(lines.filter(l => {
        try { return new Date(JSON.parse(l).timestamp) >= d; }
        catch { return false; }
      }));
    }
    res.json(lines);
  });

  // ── Appointment history ──────────────────────────────────────────
  app.get('/appointment-history', (req, res) => {
    if (!resultsDir) return res.status(503).json({ error: 'resultsDir not configured' });
    const { item, range } = req.query;
    let since;
    if (range === 'month') since = new Date(Date.now() - 30 * 86400000).toISOString();
    else if (range === 'year') since = new Date(Date.now() - 365 * 86400000).toISOString();
    const events = queryEvents(resultsDir, { item, since });
    res.json({ events });
  });

  // ── Email subscriptions ─────────────────────────────────────────
  app.post('/subscribe', async (req, res) => {
    const { email } = req.body || {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, message: 'Invalid email address.' });
    }

    const token = addPending(email);
    if (!token) {
      return res.json({ ok: true, already: true, message: 'You are already subscribed.' });
    }

    const port = process.env.TRACKER_PORT || 3001;
    const baseUrl = process.env.TRACKER_BASE_URL || `http://localhost:${port}`;
    const confirmUrl = `${baseUrl}/confirm-subscription?token=${token}`;

    await sendEmail(
      email,
      'Confirm your King County appointment alert subscription',
      `Hi,\n\nClick the link below to confirm your subscription:\n\n${confirmUrl}\n\nThis link expires in 24 hours. If you did not request this, you can ignore this email.`
    );

    logger.info('Subscription confirmation sent', { email });
    res.json({ ok: true, message: 'Confirmation email sent. Please check your inbox.' });
  });

  app.get('/confirm-subscription', (req, res) => {
    const ok = confirm(req.query.token || '');
    if (ok) {
      res.send(confirmationPage(true));
    } else {
      res.status(400).send(confirmationPage(false));
    }
  });

  app.get('/subscribers', (req, res) => {
    res.json({ subscribers: allSubscribers() });
  });

  return app;
}

function confirmationPage(success) {
  const title = success ? 'Subscription confirmed!' : 'Invalid or expired link';
  const body = success
    ? 'You will now receive email notifications when King County appointments become available.'
    : 'This confirmation link is invalid or has expired. Please return to the dashboard and subscribe again.';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; border-radius: 8px; padding: 40px; max-width: 480px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
    h2 { color: ${success ? '#52c41a' : '#ff4d4f'}; }
    a { color: #1677ff; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h2>${success ? '✓' : '✗'} ${title}</h2>
    <p>${body}</p>
    <a href="/">← Back to dashboard</a>
  </div>
</body>
</html>`;
}

function startServer(app) {
  const port = process.env.TRACKER_PORT || 3001;
  app.listen(port, () => {
    logger.info('Tracker HTTP API listening', { port });
  });
}

module.exports = { createApp, startServer };
