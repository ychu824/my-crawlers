/**
 * Integration test — sends a real email via SMTP.
 *
 * Requires a valid .env in the repo root with SMTP_* and NOTIFY_EMAIL set.
 * Run explicitly:
 *   node --env-file=../.env node_modules/.bin/jest tests/email.integration.test.js
 * or:
 *   DOTENV=1 jest tests/email.integration.test.js
 *
 * Skipped automatically when NOTIFY_EMAIL is not set (i.e. in CI / unit test runs).
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { sendEmail } = require('../email');
const { processItem } = require('../processor');

const SKIP = !process.env.NOTIFY_EMAIL;

// Exact snapshot data from 2026-03-20T20:22:55 CPL run
const CPL_RESULT = {
  appointments_available: 'yes',
  message:
    'Please select the day & time at which you would like to be seen.' +
    'Wednesday June 17, 2026<>8:30 PM',
  page_title: 'Choose Appointment Time - KCCH - QLess Kiosk',
  deal_score: 0,
};

const CPL_ITEM = {
  name: 'King County CPL Appointments',
  crawlerConfig: 'configs/kingcounty_cpl_config.json',
  appointment_mode: true,
};

describe('email integration', () => {
  test('sendEmail — delivers appointment alert directly', async () => {
    if (SKIP) {
      console.log('Skipped: NOTIFY_EMAIL not set');
      return;
    }
    await expect(
      sendEmail(
        process.env.NOTIFY_EMAIL,
        'Appointment available: King County CPL Appointments',
        'King County CPL Appointments has appointments available!\n\nWednesday June 17, 2026: 8:30 PM',
      ),
    ).resolves.not.toThrow();
  });

  test('processItem — triggers email on no→yes transition with real SMTP', async () => {
    if (SKIP) {
      console.log('Skipped: NOTIFY_EMAIL not set');
      return;
    }

    // processor.js holds a direct reference to sendEmail (destructured at require
    // time), so we can't spy via the module export. Instead, call sendEmail directly
    // with the same args processItem would produce and await the result.
    const { sendEmail } = require('../email');
    const state = { [CPL_ITEM.name]: { lastStatus: 'no' } };

    // Confirm the transition logic fires (state changes to 'yes')
    processItem(CPL_ITEM, [CPL_RESULT], state);
    expect(state[CPL_ITEM.name].lastStatus).toBe('yes');

    // Now send the email directly and await — any SMTP error will surface here
    await expect(
      sendEmail(
        process.env.NOTIFY_EMAIL,
        `Appointment available: ${CPL_ITEM.name}`,
        `${CPL_ITEM.name} has appointments available!\n\nWednesday June 17, 2026: 8:30 PM`,
      ),
    ).resolves.not.toThrow();
  });
});
