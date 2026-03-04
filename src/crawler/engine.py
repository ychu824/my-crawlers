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
            if self.wait_for_selector:
                page.wait_for_selector(self.wait_for_selector)
            else:
                page.wait_for_load_state("networkidle")
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

    def run(self) -> List[Dict[str, Any]]:
        html = self.fetch()
        return self.parse(html)
