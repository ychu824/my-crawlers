# my-crawlers
Crawlers for my daily life

## Setup

1. (Linux/macOS) create & activate a virtualenv:
   ```bash
   python3 -m venv venv && source venv/bin/activate
   ```

2. install Python requirements and Playwright browsers:
   ```bash
   pip install -r requirements.txt
   playwright install
   ```

3. *Ubuntu 22 LTS only*: install system packages first:
   ```bash
   sudo apt update && sudo apt install -y python3 python3-pip python3-venv \
       libgconf-2-4 libnss3 libxss1 libappindicator1 libindicator7 libgbm1 \
       fonts-liberation xdg-utils
   ```

That’s it—the environment is ready for crawling.

## Usage

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
```
**Arguments:**
- `--config` (required): Path to the JSON configuration file
- `--output` (optional): Path to save the output JSON file. If not specified, results are printed to stdout
- `--search` (optional): Search for items by keyword (searches in name field by default)
- `--search-field` (optional): Field to search in (default: name)

### Examples

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

### EVO skis

A new configuration is provided at `configs/evo_skis_config.json` for scraping
ski deals from the EVO website.  Because EVO’s Cloudflare protection is strict,
Playwright must be used, and you may need to run the crawler from an IP that’s
not blocked.

You can search by brand and rank results by a simple “good deal” score:

```bash
source venv/bin/activate
python main.py --config configs/evo_skis_config.json \
    --search "fischer" --brand "Fischer" --score
```

Brand/model shortcut CLI:

```bash
source venv/bin/activate
python ski_search.py --brand "Blizzard" --model "Zero 105" \
  --output output/evo_latest.json
```

This wrapper auto-selects a category (for example `blizzard`, `backcountry`, or `ski`)
and calls `main.py` for you.

Interactive CLI:

```bash
source venv/bin/activate
python ski_search_interactive.py
```

Then follow the prompts for brand/model/category/output.

**Deal metric:**
1. Higher price with a larger discount ratio produces a higher score.
2. Newer model years (looks for 2015+ in the product name) add bonus points.
3. Brand filtering is supported via `--brand`.

Results will include a `deal_score` field and are sorted when `--score` is used.

---

## Periodic Tracking Service (Node.js)

A lightweight tracker resides in the `tracker/` directory. It schedules crawls,
remembers past prices, and notifies you of drops. The service also exposes a
small HTTP API so local agents can query logs or status.

### Setup

Install Node dependencies and start the service:

```bash
# on Ubuntu use the system Python; on macOS you can point to the venv
export PYTHON=/usr/bin/python3   # optional override for deploy
./start-tracker.sh
```

You may run this from `cron` or your preferred init system.  The script will
install npm packages if they are missing.

### Configuration

`tracker/config.json` contains an array of objects specifying what to track:

```json
[
  {
    "name": "Fischer RC4 2025",
    "crawlerConfig": "configs/evo_skis_config.json",
    "search": "Fischer RC4 2025",
    "brand": "Fischer"
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

### Notifications

Set the following environment variables before starting the tracker:

```bash
export SMTP_HOST=smtp.example.com
export SMTP_PORT=587
export SMTP_USER=...
export SMTP_PASS=...
export SMTP_FROM="crawler@example.com"
export NOTIFY_EMAIL="you@domain.com"
```

When a price drop is detected, an email is sent to `NOTIFY_EMAIL`.

By default each crawler run has a 2‑minute timeout, so a blocked site won’t hang the
entire schedule.  Timeout errors appear in the log and the tracker moves to the
next item automatically.

### Logs & diagnostics

Logs are written to `tracker/logs/tracker.log` in JSON format.  To inspect
recent entries use the HTTP API:

- `GET http://localhost:3001/status` – current configuration and state
- `GET http://localhost:3001/logs` – all log lines
- `GET http://localhost:3001/logs?since=2026-03-04T10:00:00Z` – only entries since
a timestamp

Your local agent (or an ad-hoc `curl`) can poll these endpoints for useful
information.

To inspect the latest snapshots:

```bash
ls -lt output/tracker | head
cat output/tracker/<latest-file>.json
```

### Cron example

```cron
# run tracker every hour
0 * * * * cd /path/to/my-crawlers && ./start-tracker.sh
```

```bash
source venv/bin/activate
python main.py --config configs/gundeals_config.json --search "Beretta M9" --output beretta_m9_deals.json
```

## Configuration

Each crawler has a corresponding JSON configuration file in the `configs/` directory. Customize the URL and extraction rules in these files to suit your needs.

## Unit Tests

Run all Python unit tests:

```bash
source venv/bin/activate
python -m unittest discover -s tests -p 'test_*.py' -v
```

## Deployment to Azure VM

This repository includes a GitHub Action to automate deployments to an Azure Virtual Machine.

### Initial VM Setup

1. SSH into your VM.
2. Clone the repository into `/home/azureuser/my-crawlers`:
   ```bash
   cd /home/azureuser
   git clone https://github.com/your-username/my-crawlers.git
   ```
3. Ensure Node.js and Python 3 are installed on the VM.

### GitHub Secrets

To enable automatic deployments, configure:

- `VM_SSH_KEY`: Content of `my-linux-pw.pem` (including `-----BEGIN ...` / `-----END ...` lines).

The workflow does **not** store the key in `deploy.yml`. It loads the key from
GitHub Secrets at runtime, writes it to a temporary file in the runner, and
deletes it after deployment.
Use a dedicated CI deploy key without interactive passphrase prompts.

### GitHub Variables

- `VM_HOST`: Azure VM public IP or hostname (for your current setup: `20.83.237.230`)
- `VM_USERNAME`: SSH username (for your current setup: `azureuser`)
- `VM_PORT` (optional): SSH port (`22` if omitted)

SSH command for manual verification:

```bash
ssh -i my-linux-pw.pem azureuser@20.83.237.230
```

Once configured, any push to `main` (or manual run from Actions tab) triggers deployment. The deployment script (`deploy.sh`) pulls latest code, updates dependencies, and restarts `my-crawlers.service`.
