import requests
from bs4 import BeautifulSoup
import json
import re
from typing import List, Dict, Any, Union
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

class GenericCrawler:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.url = config.get("url")
        self.items_selector = config.get("items_selector")
        self.fields = config.get("fields", {})
        self.use_playwright = config.get("use_playwright", False)
        self.wait_for_selector = config.get("wait_for_selector")
        self.headers = config.get("headers", {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        })

    def fetch(self) -> str:
        if self.use_playwright:
            return self._fetch_with_playwright()
        else:
            return self._fetch_with_requests()

    def _fetch_with_requests(self) -> str:
        response = requests.get(self.url, headers=self.headers)
        response.raise_for_status()
        return response.text

    def _fetch_with_playwright(self) -> str:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent=self.headers["User-Agent"])
            page = context.new_page()
            page.goto(self.url)
            try:
                if self.wait_for_selector:
                    page.wait_for_selector(self.wait_for_selector)
                else:
                    page.wait_for_load_state("networkidle")
            except Exception:  # timeout or other wait errors
                # ignore and proceed; content may still be returned (e.g., Cloudflare block page)
                pass
            content = page.content()
            browser.close()
            return content

    def _extract_field(self, element, field_name: str, field_config: Union[str, Dict[str, Any]]) -> Any:
        if not element:
            return None

        selector = field_config if isinstance(field_config, str) else field_config.get("selector")
        target_element = element.select_one(selector) if selector else element
        if not target_element:
            return None

        # Determine attribute to extract
        attr = None
        if isinstance(field_config, dict):
            attr = field_config.get("attribute")
        elif selector and "[" in selector and selector.endswith("]"):
            attr = selector.split("[")[-1][:-1]

        if not attr and target_element.name == "a" and (field_name == "link" or field_name == "url"):
            attr = "href"

        # Extract value
        if attr:
            val = target_element.get(attr)
            if attr in ["href", "src", "action"] and val:
                val = urljoin(self.url, val)
        else:
            val = target_element.get_text(strip=True)

        # Apply regex post-processing if defined
        if isinstance(field_config, dict) and "regex" in field_config and val:
            match = re.search(field_config["regex"], val)
            if match:
                val = match.group(1) if match.groups() else match.group(0)

        return val

    def parse(self, html: str) -> List[Dict[str, Any]]:
        soup = BeautifulSoup(html, 'html.parser')
        results = []

        if self.items_selector:
            items = soup.select(self.items_selector)
            for item in items:
                extracted_item = {}
                for field_name, field_config in self.fields.items():
                    extracted_item[field_name] = self._extract_field(item, field_name, field_config)
                results.append(extracted_item)
        else:
            extracted_item = {}
            for field_name, field_config in self.fields.items():
                extracted_item[field_name] = self._extract_field(soup, field_name, field_config)
            results.append(extracted_item)

        return results

    def _fetch_url(self, url: str) -> str:
        """Helper that fetches a given URL using the appropriate method."""
        if self.use_playwright:
            # temporarily override self.url for playwright fetch
            original = self.url
            self.url = url
            try:
                return self._fetch_with_playwright()
            finally:
                self.url = original
        else:
            # simple requests get
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return response.text

    def run(self, query: str = None, category: str = None) -> List[Dict[str, Any]]:
        """Run the crawler, optionally performing a search or loading a specific category.

        - If ``query`` is provided and the configuration contains a ``search_url``
          template, it will be used to build the request URL.
        - If ``category`` is provided and the configuration contains a
          ``categories`` mapping, the corresponding URL will be used.
        - Pagination is supported when ``page_param`` and ``max_pages`` are
          defined in the configuration.  The crawler will iterate through pages
          until reaching ``max_pages`` or until no new items are found.
        """
        base_url = self.url
        # category overrides base URL
        if category and isinstance(self.config.get("categories"), dict):
            cat_map = self.config.get("categories")
            if category in cat_map:
                base_url = cat_map[category]
        page_param = self.config.get("page_param")
        max_pages = int(self.config.get("max_pages", 1))
        page_start = int(self.config.get("page_start", 1))

        def crawl_url(start_url: str) -> List[Dict[str, Any]]:
            results: List[Dict[str, Any]] = []
            seen = set()

            def add_items(items: List[Dict[str, Any]]) -> int:
                added = 0
                for item in items:
                    link = item.get("link")
                    if link:
                        key = ("link", link)
                    else:
                        key = ("fields", item.get("name"), item.get("price"))
                    if key in seen:
                        continue
                    seen.add(key)
                    results.append(item)
                    added += 1
                return added

            if page_param and max_pages > 1:
                # First page is usually the base URL without any page parameter.
                html = self._fetch_url(start_url)
                first_items = self.parse(html)
                if not first_items:
                    return []
                add_items(first_items)

                # Then crawl subsequent pages. `page_start` defaults to 1 so this
                # works for both zero- and one-indexed sites (duplicates are deduped).
                for page in range(page_start, page_start + max_pages - 1):
                    sep = "?" if "?" not in start_url else "&"
                    url = f"{start_url}{sep}{page_param}={page}"
                    html = self._fetch_url(url)
                    items = self.parse(html)
                    if not items:
                        break
                    add_items(items)
                return results
            html = self._fetch_url(start_url)
            return self.parse(html)

        # Search URL can be flaky for some sites; if it yields no items, fall
        # back to the selected base/category URL so local filtering can still work.
        if query and self.config.get("search_url"):
            from urllib.parse import quote

            tmpl = self.config["search_url"]
            search_url = tmpl.format(query=quote(query))
            search_results = crawl_url(search_url)
            if search_results:
                return search_results

        return crawl_url(base_url)
