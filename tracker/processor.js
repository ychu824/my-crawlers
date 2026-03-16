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
 * Process appointment-tracking items — notify when slots open up.
 */
function processAppointmentItem(item, results, state) {
  // results is typically a single-element array with field values
  const result = results[0] || {};
  const available = (result.appointments_available || '').toLowerCase();
  const message = result.message || result.appointments_available || 'Check the booking page for details.';

  const stateEntry = state[item.name] || {};
  const wasAvailable = stateEntry.lastStatus === 'yes';

  if (available === 'yes') {
    logger.info('Appointments available', { item: item.name, message });
    // only notify on transition (not-available → available) to avoid spam
    if (!wasAvailable && process.env.NOTIFY_EMAIL) {
      const vars = { item: item.name, message };
      sendEmail(process.env.NOTIFY_EMAIL, render(APPT_SUBJECT, vars), render(APPT_BODY, vars));
    }
  } else {
    logger.info('No appointments available', { item: item.name, status: available });
  }

  state[item.name] = { lastStatus: available, lastMessage: message, lastChecked: new Date().toISOString() };
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
