# my-crawlers
Crawlers for my daily life

## Setup

### Prerequisites (Install Python 3)

- **Ubuntu**:
  ```bash
  sudo apt update && sudo apt install -y python3 python3-pip python3-venv
  ```
- **Windows**:
  Download and install from [python.org](https://www.python.org/downloads/). **Important**: during installation, check the box **"Add Python to PATH"**.

1. create & activate a virtualenv:
   - **Linux/macOS**:
     ```bash
     python3 -m venv venv && source venv/bin/activate
     ```
   - **Windows**:
     ```bash
     python -m venv venv
     venv\Scripts\activate
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

### Troubleshooting

- Permission errors: run from project root with correct permissions
- Playwright issues: ensure the above system packages are installed
- Low-memory machines: run one crawler at a time or increase swap

## Usage

Run any crawler by pointing at a JSON configuration and optional filters (Windows users use `venv\Scripts\activate` instead of `source`):
```bash
source venv/bin/activate
python main.py --config <config_file_path> [--output out.json] \
    [--search "keyword"] [--brand "Brand"]
```

Shortcuts (same command, pre‑selected configs):
```bash
python main.py --config configs/gundeals_config.json   # gun.deals
python main.py --config configs/news_config.json       # news
python main.py --config configs/price_config.json      # price sites
```
**Arguments:**
- `--config` (required): Path to the JSON configuration file
- `--output` (optional): Path to save the output JSON file. If not specified, results are printed to stdout
- `--search` (optional): Search for items by keyword (searches in name field by default)
- `--search-field` (optional): Field to search in (default: name)

### Examples

*Note: Windows users use `venv\Scripts\activate` instead of `source venv/bin/activate`.*

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

*Note: Windows users use `venv\Scripts\activate` instead of `source venv/bin/activate`.*

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

- **Linux/macOS**:
  ```bash
  # on Ubuntu use the system Python; on macOS you can point to the venv
  export PYTHON=/usr/bin/python3   # optional override for deploy
  ./start-tracker.sh
  ```
- **Windows**:
  ```cmd
  start-tracker.bat
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

### Cron example

```cron
# run tracker every hour
0 * * * * cd /path/to/my-crawlers && ./start-tracker.sh
```

---

Search for Beretta M9 and save results (Windows users use `venv\Scripts\activate`):
```bash
source venv/bin/activate
python main.py --config configs/gundeals_config.json --search "Beretta M9" --output beretta_m9_deals.json
```

## Configuration

Each crawler has a corresponding JSON configuration file in the `configs/` directory. Customize the URL and extraction rules in these files to suit your needs.
