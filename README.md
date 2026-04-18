# my-crawlers
Crawlers for my daily life, (evo, gun.deals, King County CPL appointment implemented)

## 1. Setup

1. Create & activate a virtualenv:
   ```bash
   # Ubuntu/Debian only — skip if python3 -m venv already works
   sudo apt-get install -y python3.12-venv

   python3 -m venv venv && source venv/bin/activate
   ```

2. install Python requirements and Playwright browsers:
   ```bash
   pip install -r requirements.txt
   playwright install --with-deps chromium
   ```

That’s it—the environment is ready for crawling.

## 2. Usage

Run any crawler by pointing at a JSON configuration and optional filters:
```bash
source venv/bin/activate
python main.py --config <config_file_path> [--output out.json] \
    [--search "keyword"] [--brand "Brand"]
```

Shortcuts (same command, pre‑selected configs):
```bash
python main.py --config configs/gundeals_config.json   # gun.deals
python main.py --config configs/price_config.json      # price sites
python main.py --config configs/kingcounty_cpl_config.json  # King County CPL appointments
```
**Arguments:**
- `--config` (required): Path to the JSON configuration file
- `--output` (optional): Path to save the output JSON file. If not specified, results are printed to stdout
- `--search` (optional): Search for items by keyword (searches in name field by default)
- `--search-field` (optional): Field to search in (default: name)
- `--category` (optional): Fetch a specific category defined in the config (e.g. `handgun`)
- `--brand` (optional): Filter results by brand name (case-insensitive)
- `--score` (optional): Compute and sort results by deal score (good deals first)

### 2.1 Examples

#### 2.1.1 Gun.deals

Run gun.deals crawler and save output:
```bash
source venv/bin/activate
python main.py --config configs/gundeals_config.json --output gun_deals_results.json
```

Search for a specific gun (e.g., Beretta):
```bash
source venv/bin/activate
python main.py --config configs/gundeals_config.json --search "Beretta"
```

Search with multiple keywords – the crawler will tokenize and match all terms:
```bash
source venv/bin/activate
python main.py --config configs/gundeals_config.json --search "Beretta M9 9mm handgun"
```
(This query will internally strip the generic word "handgun" and return Beretta M9 results.)

---

#### 2.1.2 EVO skis

A new configuration is provided at `configs/evo_skis_config.json` for scraping
ski deals from the EVO website.  Because EVO’s Cloudflare protection is strict,
Playwright must be used, and you may need to run the crawler from an IP that’s
not blocked.

You can search by brand and rank results by a simple “good deal” score:

```bash
source venv/bin/activate
python ski_search_interactive.py
```

**Deal metric:**
1. Higher price with a larger discount ratio produces a higher score.
2. Newer model years (looks for 2015+ in the product name) add bonus points.
3. Brand filtering is supported via `--brand`.

Results will include a `deal_score` field and are sorted when `--score` is used.

---

#### 2.1.3 King County CPL Appointments

A configuration for monitoring Concealed Pistol License (CPL) appointment availability at King County Sheriff's Office. Uses Playwright to navigate the QLess kiosk system and check for available appointment slots.

```bash
source venv/bin/activate
python main.py --config configs/kingcounty_cpl_config.json --output output/cpl_latest.json
```

**Detection Logic:**
- **Available**: Page shows appointment selection options (dates, times)
- **Unavailable**: Page shows "Sorry, no appointments are available"

The tracker service can monitor this config and send email notifications when appointments become available.

---

## 3. Periodic Tracking Service (Node.js)

A lightweight tracker resides in the `tracker/` directory. It schedules crawls,
remembers past prices, and notifies you of drops. The service also exposes a
small HTTP API so local agents can query logs or status.

### 3.1 Module Structure

| File | Responsibility |
|------|---------------|
| `tracker/index.js` | Orchestrator — config loading, state, cron scheduling, startup |
| `tracker/crawler.js` | Spawns the Python crawler subprocess |
| `tracker/processor.js` | Price comparison and appointment alert logic |
| `tracker/snapshot.js` | Writes timestamped JSON result files to `output/tracker/` |
| `tracker/gc.js` | Garbage collection for logs and old snapshots |
| `tracker/api.js` | Express HTTP server (`/status`, `/logs`, `/appointment-history`, `/subscribe`, `/unsubscribe`) |
| `tracker/logger.js` | Winston logger configuration |
| `tracker/email.js` | Email sender via nodemailer |
| `tracker/appointment-history.js` | Long-term appointment event log (1-year retention) |
| `tracker/subscribers.js` | Email subscriber management with confirmation tokens |
| `tracker/backfill-history.js` | One-shot script to seed history from existing snapshots |

### 3.2 Setup

1. Copy the environment template and fill in your values:

```bash
cp .env.example .env
# Edit .env with your real credentials
```

2. Install Node dependencies and start the service:

```bash
# on Ubuntu use the system Python; on macOS you can point to the venv
export PYTHON=/usr/bin/python3   # optional override for deploy
./start-tracker.sh
```

3. Build and optionally develop the dashboard:

```bash
# One-time build (output goes to tracker/public/, served automatically by the tracker)
cd dashboard && npm install && npm run build

# Live dev server with hot reload (proxies API calls to the tracker at :3001)
cd dashboard && npm run dev
# Then open http://localhost:5173
```

The production dashboard is served at `http://localhost:3001` by the tracker's Express server once built.

The service auto-loads `.env` from the project root via `dotenv`. Environment
variables set in the shell still take precedence over `.env` values.

**Hot-reload:** The service watches `.env` for changes and automatically reloads
environment variables without a restart. Simply edit `.env` and save — the new
values take effect on the next scheduled crawl. You can also trigger a manual
reload via the API:

```bash
curl -X POST http://localhost:3001/reload-env
```

> **Note:** Cron schedule changes (`TRACKER_CRON`, `TRACKER_GC_CRON`) require a
> full restart since cron jobs are registered once at startup.

You may run this from `cron` or your preferred init system.  The script will
install npm packages if they are missing.

### 3.3 Configuration

`tracker/config.json` contains an array of objects specifying what to track:

```json
[
  {
    "name": "Fischer RC4 2025",
    "crawlerConfig": "configs/evo_skis_config.json",
    "search": "Fischer RC4 2025",
    "brand": "Fischer"
  },
  {
    "name": "King County CPL Appointments",
    "crawlerConfig": "configs/kingcounty_cpl_config.json"
  }
]
```

- `name` – friendly identifier
- `crawlerConfig` – relative path to one of the JSON configurations
- `search` / `brand` / `category` – parameters forwarded to the Python crawler

Additional keys (thresholds, email addresses, etc.) may be added later.

State is stored in `tracker/state.json` and updated automatically.
Full per-run crawl snapshots are stored in `output/tracker/` as timestamped JSON files.

To avoid committing tracker changes, put your VM-specific edits in `tracker/config.local.json`.
The service loads config in this order:

- `TRACKER_CONFIG` environment variable, if set
- `tracker/config.local.json`, if present
- `tracker/config.json` as the committed default

Example VM workflow:

```bash
cd /home/azureuser/my-crawlers
cp tracker/config.json tracker/config.local.json
vim tracker/config.local.json
sudo systemctl restart my-crawlers.service
curl -s http://localhost:3001/status
```

The `/status` response includes `configPath`, so you can verify which config file
the tracker actually loaded.

### 3.4 Appointment History

When the tracker detects a no→yes availability transition it appends a record to `output/tracker/appointment-events.json`. This log is retained for **1 year** — the GC harvests events from expiring snapshots before deleting them, so history survives the 3-day snapshot window.

**Backfill from existing snapshots** (useful after first deploy):

```bash
# Backfill the past 3 days (default)
node tracker/backfill-history.js

# Backfill a longer window
node tracker/backfill-history.js --days 30
```

The script replays snapshots in chronological order and records only genuine no→yes transitions (same logic as the live processor), so re-running it is safe — duplicates are skipped.

**Query via API:**

```bash
# All events in the past 30 days
curl "http://localhost:3001/appointment-history?range=month"

# Past 7 days, CPL only
curl "http://localhost:3001/appointment-history?range=7d&item=CPL"
```

Supported range values: `3d`, `7d`, `month`, `year`.

---

### 3.5 Email Notifications

Configure email in `.env`:

```bash
# Gmail with App Password (recommended for personal use)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx   # Google App Password (not your login password)
SMTP_FROM=your-email@gmail.com
NOTIFY_EMAIL=recipient@example.com   # admin address(es), comma-separated

# Public URL of the tracker — used in confirmation and unsubscribe links
TRACKER_BASE_URL=http://YOUR_DOMAIN_OR_IP:3001
```

To generate a Gmail App Password: enable 2‑Step Verification, then visit
<https://myaccount.google.com/apppasswords>.

> **Important:** `TRACKER_BASE_URL` must be reachable from outside the VM (i.e. the port must be open in Azure NSG) so that confirmation and unsubscribe links in emails work. See [Deployment](#deployment-to-azure-vm).

**When are emails sent?**

| Event | Sends email? |
|-------|-------------|
| Price drops below last known price | ✅ Yes |
| Price stays the same or rises | ❌ No |
| Appointment becomes available (was unavailable) | ✅ Yes |
| Appointment still available on next check | ❌ No (transition-based) |
| Appointment unavailable | ❌ No |

**Customizable templates** — override subject/body via env vars using `{{placeholder}}` syntax:

```bash
EMAIL_PRICE_SUBJECT=Price alert: {{item}}
EMAIL_PRICE_BODY={{item}} price dropped from {{oldPrice}} to {{newPrice}}.
EMAIL_APPT_SUBJECT=Appointment available: {{item}}
EMAIL_APPT_BODY={{item}} has appointments available!\n\n{{message}}
```

By default each crawler run has a 2‑minute timeout, so a blocked site won’t hang the
entire schedule. Timeout errors appear in the log and the tracker moves to the
next item automatically.

### 3.6 Web Subscriptions

Users can subscribe for appointment alerts directly from the dashboard without any admin action.

**Flow:**
1. User enters their email in the "Get notified" form on the dashboard
2. A confirmation email is sent with a link valid for 24 hours
3. User clicks the link → subscription is confirmed
4. On the next availability transition, they receive an alert email with a personal **Unsubscribe** link at the bottom

**Subscription API endpoints:**

| Endpoint | Description |
|----------|-------------|
| `POST /subscribe` | Submit an email address; sends confirmation email |
| `GET /confirm-subscription?token=` | Confirms the subscription |
| `GET /unsubscribe?token=` | Removes the subscriber |
| `GET /subscribers` | Lists all subscribers (admin use) |

Subscriber data is stored in `tracker/subscribers.json` on the VM (not committed to git).

### 3.8 Schedule

The crawl frequency and GC schedule are configurable via `.env`:

```bash
# Crawl schedule (cron expression, default: every 10 minutes)
TRACKER_CRON=*/10 * * * *

# GC schedule (default: daily at 3:00 AM)
TRACKER_GC_CRON=0 3 * * *
```

Common cron patterns:

| Expression | Meaning |
|-----------|---------|
| `*/5 * * * *` | Every 5 minutes |
| `*/10 * * * *` | Every 10 minutes |
| `*/30 * * * *` | Every 30 minutes |
| `0 * * * *` | Every hour |

### 3.9 Log Garbage Collection

A built-in GC runs daily (configurable via `TRACKER_GC_CRON`) to prevent unbounded log growth:

- **Log trimming**: removes entries older than the retention period from `tracker/logs/tracker.log`
- **Snapshot cleanup**: deletes snapshot files in `output/tracker/` older than the retention period

The retention period defaults to **3 days** and can be configured via environment variable:

```bash
LOG_RETENTION_DAYS=7   # keep 7 days of logs instead of the default 3
```

### 3.10 Logs & diagnostics

Logs are written to `tracker/logs/tracker.log` in JSON format.  To inspect
recent entries use the HTTP API:

- `GET http://localhost:3001/status` – current configuration and state
- `GET http://localhost:3001/logs` – all log lines
- `GET http://localhost:3001/logs?since=2026-03-04T10:00:00Z` – only entries since a timestamp
- `POST http://localhost:3001/reload-env` – hot-reload `.env` without restarting
- `POST http://localhost:3001/gc` – manually trigger garbage collection (log trimming + snapshot cleanup)

Your local agent (or an ad-hoc `curl`) can poll these endpoints for useful
information.

To inspect the latest snapshots:

```bash
ls -lt output/tracker | head
cat output/tracker/<latest-file>.json
```

## 4. Appointment Trends Dashboard

A React + Ant Design dashboard served by the tracker at `http://<your-host>:3001`.

### 4.1 Running locally (mock data)

```bash
cd dashboard
npm install
npm run dev        # opens http://localhost:5173 with sample data
```

The dev server uses `import.meta.env.DEV` to detect development mode and injects mock CPL/AFL events so all charts are populated without a live VM connection.

### 4.2 Production build

```bash
cd dashboard && npm run build
# Output goes to tracker/public/ — served automatically by the tracker's Express server
```

`deploy.sh` runs this automatically on every deployment.

### 4.3 Dashboard features

| Tab | Description |
|-----|-------------|
| **Availability Timeline** | Bar chart of no→yes transitions per day/week over the selected range |
| **Appointment Dates** | Monthly calendar marking appointment slots — active slots in brand color, historical in muted color, past dates with strikethrough |
| **Release Hours** | Histogram of what hour of day slots are typically released |
| **Appointment Slots** | Which specific appointment times (e.g. 10:00 AM) appear most often |

**Range selector:** Past 3 days / 7 days / 30 days / 1 year — applies to all trend charts.

**Email subscription form** at the bottom of the page — see [section 3.6](#36-web-subscriptions).

### 4.4 First-time data seeding

After deploying for the first time, run the backfill script to populate history from existing snapshots:

```bash
# On the VM
node tracker/backfill-history.js --days 3
```

Then refresh the dashboard — the trend charts will show data immediately.

---

## Appendix

### Unit Tests

Run all Python unit tests:

```bash
source venv/bin/activate
python -m unittest discover -s tests -p 'test_*.py' -v
```

Run all Node.js (tracker) unit tests:

```bash
cd tracker
npm test
```

### Deployment to Azure VM

This repository includes a GitHub Action to automate deployments to an Azure Virtual Machine.

#### Initial VM Setup

1. SSH into your VM.
2. Clone the repository into `/home/azureuser/my-crawlers`:
   ```bash
   cd /home/azureuser
   git clone https://github.com/your-username/my-crawlers.git
   ```
3. Ensure Node.js and Python 3 are installed on the VM.

#### GitHub Secrets

To enable automatic deployments, configure:

- `VM_SSH_KEY`: Content of `my-linux-pw.pem` (including `-----BEGIN ...` / `-----END ...` lines).

The workflow does **not** store the key in `deploy.yml`. It loads the key from
GitHub Secrets at runtime, writes it to a temporary file in the runner, and
deletes it after deployment.
Use a dedicated CI deploy key without interactive passphrase prompts.

#### GitHub Variables

- `VM_HOST`: Azure VM public IP or hostname
- `VM_USERNAME`: SSH username (for your current setup: `azureuser`)
- `VM_PORT` (optional): SSH port (`22` if omitted)
- `DEPLOY_PATH` (optional): Absolute path to the repo on the VM (default: `/home/azureuser/my-crawlers`)

SSH command for manual verification:

```bash
ssh -i my-linux-pw.pem azureuser@xxx.xxx.xxx.xxx
```

Once configured, any push to `main` (or manual run from Actions tab) triggers deployment. The deployment script (`deploy.sh`) pulls latest code, updates dependencies, and restarts `my-crawlers.service`.
