const logger = require('./logger');
const { sendEmail } = require('./email');
const { appendEvent } = require('./appointment-history');
const { confirmedSubscribers } = require('./subscribers');

const PRICE_SUBJECT = process.env.EMAIL_PRICE_SUBJECT || 'Price alert: {{item}}';
const PRICE_BODY = process.env.EMAIL_PRICE_BODY ||
  '{{item}} price dropped from {{oldPrice}} to {{newPrice}}.';

const APPT_SUBJECT = process.env.EMAIL_APPT_SUBJECT || 'Appointment available: {{item}}';
const APPT_BODY = process.env.EMAIL_APPT_BODY ||
  '{{item}} has appointments available!\n\n{{message}}';

function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`
  );
}

function processPriceItem(item, results, state) {
  let currentPrice = null;
  results.forEach(r => {
    if (r.price) {
      const p = parseFloat(r.price.replace(/[^0-9.]/g, ''));
      if (!isNaN(p) && (currentPrice === null || p < currentPrice)) currentPrice = p;
    }
  });

  const stateEntry = state[item.name] || {};
  if (currentPrice !== null) {
    if (!stateEntry.lastPrice || currentPrice < stateEntry.lastPrice) {
      logger.info('Price drop detected', { item: item.name, old: stateEntry.lastPrice, new: currentPrice });
      if (process.env.NOTIFY_EMAIL) {
        const vars = { item: item.name, oldPrice: stateEntry.lastPrice || 'N/A', newPrice: currentPrice };
        sendEmail(process.env.NOTIFY_EMAIL, render(PRICE_SUBJECT, vars), render(PRICE_BODY, vars));
      }
    }
    state[item.name] = { lastPrice: currentPrice, lastChecked: new Date().toISOString() };
  }
}

/**
 * Parse raw kiosk text into a human-readable appointment summary.
 * Input example:
 *   "...Please select the day & time at which you would like to be seen.Monday June 15, 2026<>6:45 PM8:00 PM"
 * Output:
 *   "Monday June 15, 2026: 6:45 PM, 8:00 PM"
 */
function parseAppointmentMessage(raw) {
  if (!raw) return 'Check the booking page for details.';

  const selectMatch = raw.match(/Please select the day[^.]*\.([\s\S]*)/i);
  if (!selectMatch) return raw;

  const body = selectMatch[1].trim();
  const parts = body.split('<>').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return body || raw;

  const date = parts[0];
  const timesRaw = parts.slice(1).join(' ');
  const times = timesRaw.match(/\d+:\d+\s*(AM|PM)/gi) || [timesRaw];

  return `${date}: ${times.join(', ')}`;
}

function processAppointmentItem(item, results, state, resultsDir) {
  const result = results[0] || {};
  const available = (result.appointments_available || '').toLowerCase();
  const rawMessage = result.message || result.appointments_available || '';
  const message = parseAppointmentMessage(rawMessage);

  const stateEntry = state[item.name] || {};
  const wasAvailable = stateEntry.lastStatus === 'yes';
  const isAvailable = available === 'yes' || available === 'unknown';

  if (isAvailable) {
    logger.info('Appointments detected', { item: item.name, status: available, message });

    // Record and notify only on transition (no → yes) to avoid duplicates
    if (!wasAvailable) {
      if (resultsDir) appendEvent(resultsDir, { item: item.name, message });
      const port = process.env.TRACKER_PORT || 3001;
      const baseUrl = process.env.TRACKER_BASE_URL || `http://localhost:${port}`;
      const vars = { item: item.name, message };
      const subject = render(APPT_SUBJECT, vars);
      const bodyBase = render(APPT_BODY, vars);

      // NOTIFY_EMAIL addresses (admin-configured) get one combined email
      const base = process.env.NOTIFY_EMAIL
        ? process.env.NOTIFY_EMAIL.split(',').map(e => e.trim()).filter(Boolean)
        : [];
      if (base.length) sendEmail(base, subject, bodyBase);

      // Web subscribers get individual emails with a personalized unsubscribe link
      for (const { email, unsubscribeToken } of confirmedSubscribers()) {
        const unsubUrl = `${baseUrl}/unsubscribe?token=${unsubscribeToken}`;
        sendEmail(email, subject, `${bodyBase}\n\n---\nTo stop receiving these alerts: ${unsubUrl}`);
      }
    }
  } else {
    logger.info('No appointments available', { item: item.name, status: available });
  }

  state[item.name] = {
    lastStatus: isAvailable ? 'yes' : available,
    lastMessage: message,
    lastChecked: new Date().toISOString(),
  };
}

function processItem(item, results, state, resultsDir) {
  if (item.appointment_mode) {
    processAppointmentItem(item, results, state, resultsDir);
  } else {
    processPriceItem(item, results, state);
  }
}

module.exports = { processItem, parseAppointmentMessage };
