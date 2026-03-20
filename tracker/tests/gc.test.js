jest.mock('../logger', () => ({ info: jest.fn(), error: jest.fn() }));

const fs = require('fs');
const path = require('path');
const os = require('os');
const { gcLogs } = require('../gc');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-test-'));
  process.env.LOG_RETENTION_DAYS = '3';
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.LOG_RETENTION_DAYS;
});

// ── helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000);
}

function writeSnapshot(dir, filename, mtime) {
  const fp = path.join(dir, filename);
  fs.writeFileSync(fp, '{}');
  fs.utimesSync(fp, mtime, mtime);
  return fp;
}

function makeLogLine(timestamp) {
  return JSON.stringify({ timestamp: timestamp.toISOString(), level: 'info', message: 'test' });
}

// ── snapshot GC ──────────────────────────────────────────────────────────────

describe('gcLogs — snapshot deletion', () => {
  test('deletes files older than retention period', () => {
    const old = writeSnapshot(tmpDir, 'old.json', daysAgo(4));
    gcLogs(tmpDir);
    expect(fs.existsSync(old)).toBe(false);
  });

  test('keeps files within retention period', () => {
    const recent = writeSnapshot(tmpDir, 'recent.json', daysAgo(2));
    gcLogs(tmpDir);
    expect(fs.existsSync(recent)).toBe(true);
  });

  test('keeps files exactly at the cutoff boundary', () => {
    // exactly 3 days ago — cutoff is exclusive (mtime < cutoff), so this is kept
    const boundary = writeSnapshot(tmpDir, 'boundary.json', daysAgo(3));
    gcLogs(tmpDir);
    expect(fs.existsSync(boundary)).toBe(true);
  });

  test('handles empty snapshot directory without error', () => {
    expect(() => gcLogs(tmpDir)).not.toThrow();
  });

  test('handles non-existent snapshot directory without error', () => {
    expect(() => gcLogs(path.join(tmpDir, 'nonexistent'))).not.toThrow();
  });

  test('deletes only old files when mixed ages present', () => {
    const old = writeSnapshot(tmpDir, 'old.json', daysAgo(5));
    const recent = writeSnapshot(tmpDir, 'recent.json', daysAgo(1));
    gcLogs(tmpDir);
    expect(fs.existsSync(old)).toBe(false);
    expect(fs.existsSync(recent)).toBe(true);
  });

  test('respects LOG_RETENTION_DAYS env override', () => {
    process.env.LOG_RETENTION_DAYS = '7';
    jest.resetModules();
    jest.mock('../logger', () => ({ info: jest.fn(), error: jest.fn() }));
    const { gcLogs: gcLogs7 } = require('../gc');

    const file = writeSnapshot(tmpDir, 'file.json', daysAgo(5));
    gcLogs7(tmpDir);
    // 5 days < 7 day retention → kept
    expect(fs.existsSync(file)).toBe(true);
  });
});

// ── log trimming ─────────────────────────────────────────────────────────────

describe('gcLogs — tracker.log trimming', () => {
  let logsDir;
  let logFile;

  beforeEach(() => {
    logsDir = path.join(__dirname, '..', 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    logFile = path.join(logsDir, 'tracker.log');
  });

  afterEach(() => {
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
  });

  test('removes log lines older than retention period', () => {
    const oldLine = makeLogLine(daysAgo(5));
    const newLine = makeLogLine(daysAgo(1));
    fs.writeFileSync(logFile, [oldLine, newLine].join('\n') + '\n');

    gcLogs(tmpDir);

    const remaining = fs.readFileSync(logFile, 'utf8');
    expect(remaining).not.toContain(JSON.parse(oldLine).timestamp);
    expect(remaining).toContain(JSON.parse(newLine).timestamp);
  });

  test('keeps log lines within retention period', () => {
    const newLine = makeLogLine(daysAgo(1));
    fs.writeFileSync(logFile, newLine + '\n');

    gcLogs(tmpDir);

    expect(fs.readFileSync(logFile, 'utf8')).toContain(JSON.parse(newLine).timestamp);
  });

  test('results in empty file when all lines are old', () => {
    const oldLine = makeLogLine(daysAgo(10));
    fs.writeFileSync(logFile, oldLine + '\n');

    gcLogs(tmpDir);

    expect(fs.readFileSync(logFile, 'utf8')).toBe('');
  });

  test('silently drops malformed (non-JSON) log lines', () => {
    const newLine = makeLogLine(daysAgo(1));
    fs.writeFileSync(logFile, ['not-json', newLine].join('\n') + '\n');

    gcLogs(tmpDir);

    const remaining = fs.readFileSync(logFile, 'utf8');
    expect(remaining).not.toContain('not-json');
    expect(remaining).toContain(JSON.parse(newLine).timestamp);
  });

  test('handles missing tracker.log without error', () => {
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
    expect(() => gcLogs(tmpDir)).not.toThrow();
  });
});
