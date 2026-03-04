import json
import argparse
import sys
from src.crawler.engine import GenericCrawler

def main():
    parser = argparse.ArgumentParser(description="Generic Web Crawler CLI")
    parser.add_argument("--config", help="Path to the JSON configuration file", required=True)
    parser.add_argument("--output", help="Path to save the output JSON (optional)")

    args = parser.parse_args()

    try:
        with open(args.config, 'r') as f:
            config = json.load(f)
    except FileNotFoundError:
        print(f"Error: Config file '{args.config}' not found.")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Failed to decode JSON from '{args.config}'.")
        sys.exit(1)

    crawler = GenericCrawler(config)

    print(f"Starting crawler: {config.get('name', 'Unnamed Crawler')}...")
    print(f"Crawling URL: {config.get('url')}")

    try:
        results = crawler.run()
        print(f"Successfully crawled {len(results)} items.")

        if args.output:
            with open(args.output, 'w') as f:
                json.dump(results, f, indent=4)
            print(f"Results saved to {args.output}")
        else:
            print(json.dumps(results, indent=4))

    except Exception as e:
        print(f"An error occurred during crawling: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
