const logger = require('./logger');
const { sendEmail } = require('./email');

// Default templates — override via env vars if desired
const PRICE_SUBJECT = process.env.EMAIL_PRICE_SUBJECT || 'Price alert: {{item}}';
const PRICE_BODY = process.env.EMAIL_PRICE_BODY ||
  '{{item}} price dropped from {{oldPrice}} to {{newPrice}}.';

const APPT_SUBJECT = process.env.EMAIL_APPT_SUBJECT || 'Appointment available: {{item}}';
const APPT_BODY = process.env.EMAIL_APPT_BODY ||
  '{{item}} has appointments available!\n\n{{message}}';

/**
 * Simple template renderer — replaces {{key}} placeholders with values.
 */
function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`;
  });
}

/**
 * Process price-tracking items — detect drops and notify.
 */
function processPriceItem(item, results, state) {
  let currentPrice = null;
  results.forEach(r => {
    if (r.price) {
      const m = r.price.replace(/[^0-9.]/g, '');
      const p = parseFloat(m);
      if (!isNaN(p) && (currentPrice === null || p < currentPrice)) {
        currentPrice = p;
      }
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

  // extract everything after "Please select the day..."
  const selectMatch = raw.match(/Please select the day[^.]*\.([\s\S]*)/i);
  if (!selectMatch) return raw;

  const body = selectMatch[1].trim();
  // split on <> separator (QLess uses this between date and times)
  const parts = body.split('<>').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return body || raw;

  const date = parts[0];
  // times are concatenated without separator — split on AM/PM boundaries
  const timesRaw = parts.slice(1).join(' ');
  const times = timesRaw.match(/\d+:\d+\s*(AM|PM)/gi) || [timesRaw];

  return `${date}: ${times.join(', ')}`;
}

/**
 * Process appointment-tracking items — notify when slots open up.
 */
function processAppointmentItem(item, results, state) {
  // results is typically a single-element array with field values
  const result = results[0] || {};
  const available = (result.appointments_available || '').toLowerCase();
  const rawMessage = result.message || result.appointments_available || '';
  const message = parseAppointmentMessage(rawMessage);

  const stateEntry = state[item.name] || {};
  const wasAvailable = stateEntry.lastStatus === 'yes';

  // treat both "yes" and "unknown" as potentially available — better to
  // over-notify than miss a real appointment window
  const isAvailable = available === 'yes' || available === 'unknown';

  if (isAvailable) {
    logger.info('Appointments detected', { item: item.name, status: available, message });
    // only notify on transition (not-available → available) to avoid spam
    if (!wasAvailable && process.env.NOTIFY_EMAIL) {
      const vars = { item: item.name, message };
      sendEmail(process.env.NOTIFY_EMAIL, render(APPT_SUBJECT, vars), render(APPT_BODY, vars));
    }
  } else {
    logger.info('No appointments available', { item: item.name, status: available });
  }

  state[item.name] = { lastStatus: isAvailable ? 'yes' : available, lastMessage: message, lastChecked: new Date().toISOString() };
}

/**
 * Route to the correct processor based on item type.
 * Items with an "appointments_available" field in their config are treated as
 * appointment trackers; everything else is a price tracker.
 */
function processItem(item, results, state) {
  const isAppointment = item.fields && item.fields.appointments_available;
  if (isAppointment) {
    processAppointmentItem(item, results, state);
  } else {
    processPriceItem(item, results, state);
  }
}

module.exports = { processItem };
