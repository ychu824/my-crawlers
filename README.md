# my-crawlers
Crawlers for my daily life

## Setup

Create a virtual environment and install dependencies:

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
playwright install --with-deps
```

That's it—the environment is ready for crawling.

### Troubleshooting

- Permission errors: run from project root with correct permissions
- Playwright issues: ensure the above system packages are installed
- Low-memory machines: run one crawler at a time or increase swap

## Usage

Run any crawler by pointing at a JSON configuration and optional filters:

```bash
python main.py --config <config_file_path> [--output out.json] \
    [--search "keyword"] [--brand "Brand"] [--score]
```

**Arguments:**
- `--config` (required): Path to the JSON configuration file
- `--output` (optional): Path to save output to JSON
- `--search` (optional): Search for items by keyword
- `--brand` (optional): Filter results by brand
- `--score` (optional): Rank results by a "good deal" score

### Examples

```bash
# Basic run (gun.deals)
python main.py --config configs/gundeals_config.json

# Search with multiple keywords
python main.py --config configs/gundeals_config.json --search "Beretta M9 9mm"

# Scrape EVO skis with deal scoring
python main.py --config configs/evo_skis_config.json --search "fischer" --brand "Fischer" --score
```

---

## Tracker Service (Node.js)

A lightweight Node.js tracker in the `tracker/` directory schedules crawls and notifies you of price drops.

### Setup & Run
```bash
./start-tracker.sh
```

### Configuration & Notifications
Configure items in `tracker/config.json` and set environment variables for notifications:
```bash
export SMTP_HOST=smtp.example.com
export SMTP_PORT=587
export SMTP_USER=...
export SMTP_PASS=...
export NOTIFY_EMAIL="you@domain.com"
```

### API & Logs
The service exposes a web API on port 3001:
- `GET /status` – current configuration and state
- `GET /logs` – recent activity logs

## Configuration

Each crawler has a corresponding JSON configuration file in the `configs/` directory. Customize the URL and extraction rules in these files to suit your needs.
