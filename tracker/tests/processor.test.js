// Mock logger and email before requiring processor
jest.mock('../logger', () => ({ info: jest.fn(), error: jest.fn() }));

const mockSendEmail = jest.fn();
jest.mock('../email', () => ({ sendEmail: mockSendEmail }));

const { processItem } = require('../processor');

beforeEach(() => {
  mockSendEmail.mockClear();
  process.env.NOTIFY_EMAIL = 'test@example.com';
});

afterEach(() => {
  delete process.env.NOTIFY_EMAIL;
});

// ── appointment mode ─────────────────────────────────────────────────────────

const apptItem = { name: 'King County AFL Appointments', appointment_mode: true };

describe('processItem — appointment mode', () => {
  test('sends email on transition from no state → available', () => {
    const state = {};
    processItem(apptItem, [{ appointments_available: 'yes', message: 'Please select the day & time at which you would like to be seen.Wednesday June 17, 2026<>5:00 PM' }], state);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][1]).toMatch(/Appointment available/);
    expect(state[apptItem.name].lastStatus).toBe('yes');
  });

  test('does NOT send email when already available (no transition)', () => {
    const state = { [apptItem.name]: { lastStatus: 'yes' } };
    processItem(apptItem, [{ appointments_available: 'yes', message: 'Please select the day' }], state);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('sends email when transitioning back from unavailable to available', () => {
    const state = { [apptItem.name]: { lastStatus: 'no' } };
    processItem(apptItem, [{ appointments_available: 'yes', message: 'Please select the day' }], state);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  test('does NOT send email when unavailable', () => {
    const state = {};
    processItem(apptItem, [{ appointments_available: 'no', message: 'Sorry, no appointments' }], state);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(state[apptItem.name].lastStatus).toBe('no');
  });

  test('does NOT send email when NOTIFY_EMAIL is unset', () => {
    delete process.env.NOTIFY_EMAIL;
    const state = {};
    processItem(apptItem, [{ appointments_available: 'yes', message: 'Please select the day' }], state);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('treats unknown status as available and notifies', () => {
    const state = {};
    processItem(apptItem, [{ appointments_available: 'unknown', message: '' }], state);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(state[apptItem.name].lastStatus).toBe('yes');
  });
});

// ── parseAppointmentMessage (via email body) ─────────────────────────────────

describe('appointment email body content', () => {
  test('formats date and time from QLess message', () => {
    const state = {};
    processItem(apptItem, [{
      appointments_available: 'yes',
      message: 'Please select the day & time at which you would like to be seen.Wednesday June 17, 2026<>5:00 PM',
    }], state);
    const body = mockSendEmail.mock.calls[0][2];
    expect(body).toContain('Wednesday June 17, 2026');
    expect(body).toContain('5:00 PM');
  });
});

// ── state persistence ────────────────────────────────────────────────────────
// Root cause of missing state.json entries: before the appointment_mode fix,
// items were routed to processPriceItem which only writes state when a price
// is found. Appointment results have no price field → state was never written
// → wasAvailable always false → email sent on every check while available.

describe('state persistence — appointment mode', () => {
  test('always writes state when appointments are available', () => {
    const state = {};
    processItem(apptItem, [{ appointments_available: 'yes', message: 'Please select the day' }], state);
    expect(state[apptItem.name]).toBeDefined();
    expect(state[apptItem.name].lastStatus).toBe('yes');
    expect(state[apptItem.name].lastChecked).toBeDefined();
  });

  test('always writes state when appointments are unavailable', () => {
    const state = {};
    processItem(apptItem, [{ appointments_available: 'no', message: 'Sorry, no appointments' }], state);
    expect(state[apptItem.name]).toBeDefined();
    expect(state[apptItem.name].lastStatus).toBe('no');
  });

  test('persisted state prevents duplicate email on subsequent available check', () => {
    const state = {};
    // First run: no state → sends email, writes state
    processItem(apptItem, [{ appointments_available: 'yes', message: 'Please select the day' }], state);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    mockSendEmail.mockClear();

    // Second run: state has lastStatus='yes' → no email
    processItem(apptItem, [{ appointments_available: 'yes', message: 'Please select the day' }], state);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('persisted unavailable state allows re-notification when slots open', () => {
    const state = {};
    // First run: unavailable → no email, writes state with lastStatus='no'
    processItem(apptItem, [{ appointments_available: 'no', message: 'Sorry' }], state);
    expect(mockSendEmail).not.toHaveBeenCalled();

    // Second run: now available → transition detected → sends email
    processItem(apptItem, [{ appointments_available: 'yes', message: 'Please select the day' }], state);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  test('empty results still write state as unavailable (no crash)', () => {
    const state = {};
    processItem(apptItem, [], state);
    expect(state[apptItem.name]).toBeDefined();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe('state persistence — price mode', () => {
  test('does NOT write state when no price found in results', () => {
    // This documents the known behavior: price items with no price field
    // leave state untouched (appointment items always write state).
    const state = {};
    processItem(priceItem, [{ appointments_available: 'yes' }], state);
    expect(state[priceItem.name]).toBeUndefined();
  });
});

// ── price mode (appointment_mode absent) ─────────────────────────────────────

const priceItem = { name: 'Example Ski' };

describe('processItem — price mode', () => {
  test('sends email on price drop', () => {
    const state = { 'Example Ski': { lastPrice: 500 } };
    processItem(priceItem, [{ price: '$399.99' }], state);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][1]).toMatch(/Price alert/);
    expect(state['Example Ski'].lastPrice).toBe(399.99);
  });

  test('does NOT send email when price is same', () => {
    const state = { 'Example Ski': { lastPrice: 399.99 } };
    processItem(priceItem, [{ price: '$399.99' }], state);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('does NOT send email when price goes up', () => {
    const state = { 'Example Ski': { lastPrice: 300 } };
    processItem(priceItem, [{ price: '$399.99' }], state);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  test('sends email on first seen price (no prior state)', () => {
    const state = {};
    processItem(priceItem, [{ price: '$399.99' }], state);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });
});
