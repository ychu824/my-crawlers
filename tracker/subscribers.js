const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUBSCRIBERS_FILE = path.join(__dirname, 'subscribers.json');
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function load() {
  if (!fs.existsSync(SUBSCRIBERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function save(subs) {
  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subs, null, 2));
}

// Returns a confirmation token, or null if the email is already confirmed.
function addPending(email) {
  const subs = load();
  if (subs.find(s => s.email === email && s.confirmed)) return null;
  const token = crypto.randomBytes(20).toString('hex');
  // Replace any existing pending entry for this email
  const rest = subs.filter(s => s.email !== email);
  rest.push({
    email,
    token,
    confirmed: false,
    subscribedAt: new Date().toISOString(),
    tokenExpiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString(),
  });
  save(rest);
  return token;
}

// Returns true on success, false if token is unknown or expired.
function confirm(token) {
  const subs = load();
  const sub = subs.find(s => s.token === token && !s.confirmed);
  if (!sub) return false;
  if (new Date(sub.tokenExpiresAt) < new Date()) return false;
  sub.confirmed = true;
  sub.confirmedAt = new Date().toISOString();
  delete sub.token;
  delete sub.tokenExpiresAt;
  save(subs);
  return true;
}

function confirmedEmails() {
  return load().filter(s => s.confirmed).map(s => s.email);
}

function allSubscribers() {
  return load();
}

module.exports = { addPending, confirm, confirmedEmails, allSubscribers };
