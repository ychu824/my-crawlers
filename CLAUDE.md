# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Python (Crawler CLI)
```bash
# Setup
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
playwright install --with-deps chromium   # --with-deps required for system libs

# Run a crawler manually
python main.py --config configs/gundeals_config.json --search "glock 19"
python main.py --config configs/evo_skis_config.json --brand "Blizzard" --score
python main.py --config configs/kingcounty_cpl_config.json

# Run tests
python -m unittest discover -s tests -p 'test_*.py' -v
python -m unittest tests.test_crawler.TestGenericCrawler.test_parse_items
python -m unittest tests.test_search_helpers.TestSearchHelpers.test_tokenize_search_normalizes_and_strips_year_and_category
```

### Node.js (Tracker Service)
```bash
cd tracker && npm install

# Run all tests
npm test

# Run a single test
npm test -- --testNamePattern="sends email on price drop"

# Start tracker (cron scheduler + HTTP API)
node index.js
# or from root:
./start-tracker.sh
```

### Deployment
```bash
# Deploy to Azure VM (runs via GitHub Actions on push to main)
# Manual: SSH into VM and run:
./deploy.sh
```

## Architecture

Dual-language system: **Python** handles crawling/scraping; **Node.js** orchestrates scheduling, state, and notifications.

### Data Flow
1. `tracker/index.js` fires cron jobs per item in `tracker/config.json`
2. Each job spawns a Python subprocess (`tracker/crawler.js`) with a 120-second timeout; killed/empty on timeout
3. `main.py` runs `GenericCrawler` (`src/crawler/engine.py`) and outputs JSON to stdout via `--json-only`
4. `tracker/processor.js` compares results to `tracker/state.json`, detects changes, sends email
5. Snapshots appended to daily files: `output/tracker/YYYY-MM-DD-<item-slug>.json`

### Tracker Config Loading Order
`TRACKER_CONFIG` env var → `tracker/config.local.json` (gitignored, VM-specific) → `tracker/config.json`

### Notification Modes

**Price mode** (default): emails only on price drop (new < last). State not written if no `price` field in results — next run may re-compare against stale state.

**Appointment mode** (`appointment_mode: true` in tracker config): emails on unavailable→available transition only. State always written regardless of fields.

### Python Crawler (`src/crawler/engine.py`)
`GenericCrawler` is the sole crawl engine, driven entirely by JSON configs:
- `requests` for simple sites, `playwright` for JS-heavy/Cloudflare-protected sites
- `actions` list: sequence of `click`, `js_click`, `fill`, `wait`, `delay`, `wait_for_text` executed before extraction
- Field extraction: CSS selector → attribute or text → optional regex (captures group 1 if present, else full match)
- `${VAR_NAME}` in config values is substituted from env at crawl time (missing vars stay as literal strings)
- Deduplicates by `link` field if present, else by (name, price) tuple — within a single crawl only
- Search: replaces `{query}` in `search_url`; if 0 results, falls back to category URL (brand match > token match) then local-filters

### Search Tokenization
Tokens are normalized: lowercased, single-letter alpha dropped, years (20XX) removed, plurals/gerunds stemmed. Category names from the config's `categories` keys are also stripped. This prevents false negatives from verbose product titles like "Blizzard Zero G 105 Skis 2026".

### Deal Scoring (`--score` flag)
Finds all dollar amounts in concatenated name+price text; lowest = current price, highest = original. Score = `current * discount_ratio + year_bonus` (year 2015+ adds bonus). Results sorted descending.

### Appointment Pattern Matching
`fields[*].patterns` maps regex strings to labels. Both "no" and "yes" patterns are checked against full page text; first match in dict order wins. Label "unknown" is treated as available (fail-open to avoid missing slots).

### Environment Variables
Defined in `.env` (see `.env.example`). Key variables:
- `CPL_FIRST_NAME`, `CPL_LAST_NAME`, `CPL_PHONE` — injected into CPL config actions at runtime
- `SMTP_*` — Gmail SMTP; `NOTIFY_EMAIL` — comma-separated recipients
- `EMAIL_PRICE_SUBJECT/BODY`, `EMAIL_APPT_SUBJECT/BODY` — template overrides using `{{item}}`, `{{oldPrice}}`, `{{newPrice}}`, `{{message}}`
- `TRACKER_PORT`, `TRACKER_CRON`, `TRACKER_GC_CRON` — service settings
- `LOG_RETENTION_DAYS` — snapshot/log GC (default: 3 days, cutoff is exclusive)
- `PYTHON` — override Python interpreter path (useful for venv on deployed VM)

`.env` is watched for changes; `POST /reload-env` triggers a live reload. **Changing `TRACKER_CRON` requires a full service restart** — cron jobs are registered only at startup.
