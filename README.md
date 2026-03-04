# my-crawlers
Crawlers for my daily life

## Setup

1. Create a virtual environment:
```bash
python3 -m venv venv
```

2. Activate the virtual environment:
```bash
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
playwright install
```

## Usage

### Quick Shortcuts

**Gun Deals Crawler:**
```bash
source venv/bin/activate && python main.py --config configs/gundeals_config.json
```

**News Crawler:**
```bash
source venv/bin/activate && python main.py --config configs/news_config.json
```

**Price Crawler:**
```bash
source venv/bin/activate && python main.py --config configs/price_config.json
```

### General Usage

Run the crawler with a configuration file:
```bash
python main.py --config <config_file_path> [--output <output_file_path>]
```

**Arguments:**
- `--config` (required): Path to the JSON configuration file
- `--output` (optional): Path to save the output JSON file. If not specified, results are printed to stdout

### Examples

Run gun.deals crawler and save output:
```bash
source venv/bin/activate
python main.py --config configs/gundeals_config.json --output gun_deals_results.json
```

## Configuration

Each crawler has a corresponding JSON configuration file in the `configs/` directory. Customize the URL and extraction rules in these files to suit your needs.
