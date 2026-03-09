import json
import argparse
import sys
import re
import os
from src.crawler.engine import GenericCrawler

def normalize_token(token: str) -> str:
    token = token.strip().lower()
    if not token:
        return ""
    # Single-letter alpha tokens (e.g. "g") are usually too noisy.
    if len(token) == 1 and token.isalpha():
        return ""
    # Product years are often missing from listing titles; do not hard-require them.
    if re.fullmatch(r"(19|20)\d{2}", token):
        return ""
    # Very small stemming to improve matching (e.g. skis -> ski).
    if len(token) > 3 and token.endswith("ies"):
        token = token[:-3] + "y"
    elif len(token) > 3 and token.endswith("s"):
        token = token[:-1]
    return token

def tokenize_search(search_term: str, categories: dict | None = None) -> list:
    """Convert a raw search string into a set of tokens, optionally stripping
    out any words that correspond to configured categories.

    Returns a list of lower‑cased tokens.
    """
    if not search_term:
        return []
    category_tokens = set()
    if categories:
        for key in categories.keys():
            for part in re.findall(r"\w+", str(key).lower()):
                normalized = normalize_token(part)
                if normalized:
                    category_tokens.add(normalized)

    tokens = []
    seen = set()
    for tok in re.findall(r"\w+", search_term.lower()):
        normalized = normalize_token(tok)
        if not normalized or normalized in category_tokens or normalized in seen:
            continue
        seen.add(normalized)
        tokens.append(normalized)
    return tokens


def filter_results(results, tokens: list, search_field="name"):
    """Keep only items where **all** tokens appear in ``search_field``.

    ``tokens`` should already be normalized to lowercase.
    """
    if not tokens:
        return results
    filtered = []
    for item in results:
        value = str(item.get(search_field, "")).lower()
        if all(tok in value for tok in tokens):
            filtered.append(item)
    return filtered

def compute_deal_score(item: dict) -> float:
    """Calculate a heuristic score for "good deal" items.

    - high absolute price * discount ratio
    - recent model year (parsed from name)
    """
    price_sources = [
        str(item.get("price", "") or ""),
        str(item.get("name", "") or ""),
    ]
    price_text = " ".join(part for part in price_sources if part)
    # Some EVO listings flatten sale/original prices into a single text blob.
    # Consider every dollar amount we can find, then treat the lowest as current
    # and the highest as original.
    amounts = [float(v.replace(',', '')) for v in re.findall(r"\$([0-9,]+\.?\d*)", price_text)]
    current = 0.0
    original = 0.0
    if amounts:
        current = min(amounts)
        if len(amounts) >= 2:
            original = max(amounts)
    discount = 0.0
    if original > current > 0:
        discount = (original - current) / original
    score = current * discount
    # year bonus
    year_match = re.search(r"20(1[5-9]|2[0-9])", item.get("name", ""))
    if year_match:
        year = int(year_match.group(0))
        score += (year - 2015)
    item["deal_score"] = score
    return score


def main():
    parser = argparse.ArgumentParser(description="Generic Web Crawler CLI")
    parser.add_argument("--config", help="Path to the JSON configuration file", required=True)
    parser.add_argument("--output", help="Path to save the output JSON (optional)")
    parser.add_argument("--search", help="Keyword to search on the site (will be sent to search_url template)")
    parser.add_argument("--search-field", default="name", help="Field to further filter results after fetch (default: name)")
    parser.add_argument("--category", help="Fetch a specific category defined in the config (e.g. handgun)")
    parser.add_argument("--brand", help="Filter results by brand name (case-insensitive)")
    parser.add_argument("--score", action="store_true", help="Compute and sort results by deal score (good deals first)")
    parser.add_argument(
        "--json-only",
        action="store_true",
        help="Keep stdout as JSON-only output and write progress logs to stderr",
    )

    args = parser.parse_args()

    def log(message: str):
        stream = sys.stderr if args.json_only else sys.stdout
        print(message, file=stream)

    try:
        with open(args.config, 'r') as f:
            config = json.load(f)
    except FileNotFoundError:
        print(f"Error: Config file '{args.config}' not found.", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Failed to decode JSON from '{args.config}'.", file=sys.stderr)
        sys.exit(1)

    crawler = GenericCrawler(config)

    # compute crawl parameters and delegate to the engine
    log(f"Starting crawler: {config.get('name', 'Unnamed Crawler')}...")
    if args.category:
        log(f"Fetching category '{args.category}'")
    if args.search:
        log(f"Searching remote with keyword: '{args.search}'")

    try:
        results = crawler.run(query=args.search, category=args.category)
        log(f"Successfully crawled {len(results)} items.")

        # local filtering tokens
        if args.search:
            tokens = tokenize_search(args.search, config.get('categories'))
            log(f"Applying local filter for tokens: {tokens} (field: {args.search_field})")
            results = filter_results(results, tokens, args.search_field)
            log(f"{len(results)} items remain after local filtering.")

        # brand filter
        if args.brand:
            b = args.brand.lower()
            log(f"Applying brand filter: '{args.brand}'")
            results = [r for r in results if r.get('brand') and b in r.get('brand','').lower()]
            log(f"{len(results)} items remain after brand filtering.")

        # fallback: if no post-filter matches and categories exist, try a category page
        if args.search and not results and config.get('categories'):
            cat_choice = None
            search_tokens = {normalize_token(t) for t in re.findall(r"\w+", args.search.lower())}
            search_tokens.discard("")
            category_keys = list(config['categories'].keys())

            # Prefer explicit brand category first (most specific signal).
            if not cat_choice and args.brand:
                b = args.brand.lower().strip()
                for key in category_keys:
                    kl = str(key).lower()
                    if kl == b or kl in b or b in kl:
                        cat_choice = key
                        break

            # Then prefer exact token matches, longest key first (e.g. backcountry over ski).
            if not cat_choice:
                ranked_keys = sorted(category_keys, key=lambda k: len(str(k)), reverse=True)
                for key in ranked_keys:
                    normalized_key = normalize_token(str(key))
                    if normalized_key and normalized_key in search_tokens:
                        cat_choice = key
                        break
            if cat_choice:
                log(f"No matches found; falling back to category '{cat_choice}'.")
                cat_results = crawler.run(query=None, category=cat_choice)
                cat_tokens = tokenize_search(args.search, {cat_choice: True})
                cat_results = filter_results(cat_results, cat_tokens, args.search_field)
                if args.brand:
                    b = args.brand.lower()
                    cat_results = [r for r in cat_results if r.get('brand') and b in r.get('brand', '').lower()]
                log(f"{len(cat_results)} items found from category fallback.")
                results = cat_results

        # compute deal score and optionally sort
        if args.score:
            for item in results:
                compute_deal_score(item)
            results.sort(key=lambda r: r.get('deal_score', 0), reverse=True)
            log("Results sorted by deal score.")

        if args.output:
            output_dir = os.path.dirname(args.output)
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
            with open(args.output, 'w') as f:
                json.dump(results, f, indent=4)
            log(f"Results saved to {args.output}")
        else:
            print(json.dumps(results, indent=4))

    except Exception as e:
        print(f"An error occurred during crawling: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
