# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Python (Crawler CLI)
```bash
# Setup
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
playwright install chromium

# Run a crawler
python main.py --config configs/gundeals_config.json --search "glock 19"
python main.py --config configs/evo_skis_config.json --brand "Blizzard" --score
python main.py --config configs/kingcounty_cpl_config.json

# Run tests
python -m pytest tests/
python -m pytest tests/test_crawler.py::TestGenericCrawler::test_parse_multiple_items
```

### Node.js (Tracker Service)
```bash
cd tracker
npm install

# Start tracker (cron-based scheduler + HTTP API)
node index.js
# or from root:
./start-tracker.sh
```

### Deployment
```bash
# Deploy to Azure VM (runs via GitHub Actions on push to main)
# Manual: SSH into VM and run deploy.sh
./deploy.sh
```

## Architecture

This is a dual-language system: **Python** handles crawling/scraping, and **Node.js** orchestrates scheduling, state management, and notifications.

### Data Flow
1. **Node.js tracker** (`tracker/index.js`) runs on a cron schedule
2. It spawns **Python subprocess** (`tracker/crawler.js`) with a config file and args
3. Python CLI (`main.py`) runs `GenericCrawler` from `src/crawler/engine.py` and outputs JSON to stdout
4. Node.js **processor** (`tracker/processor.js`) compares results against persisted state (`tracker/state.json`), detects changes, and sends email notifications via `tracker/email.js`
5. Snapshots saved to `output/tracker/` with timestamps; logs via Winston (`tracker/logger.js`)

### Python Crawler (`src/crawler/engine.py`)
- `GenericCrawler` is the sole crawl engine — driven entirely by JSON config files
- Supports `requests` (simple sites) and `playwright` (JS-heavy/Cloudflare-protected sites)
- **Config-driven actions**: `click`, `js_click`, `fill`, `wait`, `delay`, `wait_for_text` for Playwright automation
- **Field extraction**: CSS selectors + optional attribute + regex post-processing
- **Environment variable substitution**: `${VAR_NAME}` in config values (used for PII like CPL form fields)
- **Search**: Replaces `{query}` in search URL; falls back to category/base URL if no results
- **Deduplication**: by link or by (name, price) tuple across paginated results

### Tracker Service (`tracker/`)
- `index.js`: Main entry — loads config/state, registers cron jobs, starts Express HTTP API
- `processor.js`: Core logic for price drop detection and appointment availability transitions
  - Appointment status uses pattern matching: strings containing "no" = unavailable, "yes" = available
- `api.js`: Express endpoints — `GET /status`, `GET /logs`, `POST /reload-env`
- `gc.js`: Cleans logs and snapshots older than configured retention (default: 3 days)

### Configuration (`configs/*.json`)
Each crawler has its own JSON config. Key fields:
- `use_playwright`: enables browser automation
- `actions`: Playwright interaction steps before extraction
- `items_selector`: CSS selector for result containers
- `fields`: map of field name → `{selector, attribute, regex}`
- `search_url` / `base_url` / `categories`: crawl targets
- `pagination`: `page_param` + `max_pages`
- `appointment_mode`: enables appointment tracking logic in processor

### Environment Variables
Defined in `.env` (see `.env.example`). Key variables:
- `CPL_FIRST_NAME`, `CPL_LAST_NAME`, `CPL_PHONE` — injected into CPL config at runtime
- `SMTP_*` — Gmail SMTP for email notifications
- `TRACKER_PORT`, `TRACKER_CRON` — tracker service settings
- `LOG_RETENTION_DAYS` — snapshot/log GC policy
- `PYTHON_INTERPRETER` — override Python path (useful for venv on deployed VM)
