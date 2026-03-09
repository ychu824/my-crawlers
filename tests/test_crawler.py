import unittest
from unittest.mock import patch, MagicMock
from src.crawler.engine import GenericCrawler

class TestGenericCrawler(unittest.TestCase):
    def test_parse_items(self):
        config = {
            "url": "http://example.com",
            "items_selector": ".item",
            "fields": {
                "title": "h2",
                "price": ".price"
            }
        }
        html = """
        <div class="item">
            <h2>Item 1</h2>
            <span class="price">$10</span>
        </div>
        <div class="item">
            <h2>Item 2</h2>
            <span class="price">$20</span>
        </div>
        """
        crawler = GenericCrawler(config)
        results = crawler.parse(html)

        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]["title"], "Item 1")
        self.assertEqual(results[0]["price"], "$10")
        self.assertEqual(results[1]["title"], "Item 2")
        self.assertEqual(results[1]["price"], "$20")

    def test_parse_single_item(self):
        config = {
            "url": "http://example.com",
            "fields": {
                "main_title": "h1"
            }
        }
        html = "<h1>Main Title</h1>"
        crawler = GenericCrawler(config)
        results = crawler.parse(html)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["main_title"], "Main Title")

    def test_parse_link_field(self):
        config = {
            "url": "http://example.com",
            "items_selector": ".product",
            "fields": {
                "link": "a"
            }
        }
        html = """
        <div class="product">
            <a href="/p1">Product 1</a>
        </div>
        """
        crawler = GenericCrawler(config)
        results = crawler.parse(html)

        self.assertEqual(results[0]["link"], "http://example.com/p1")

    def test_parse_attr_selector(self):
        config = {
            "url": "http://example.com",
            "fields": {
                "image_src": "img[src]"
            }
        }
        html = '<img src="test.jpg">'
        crawler = GenericCrawler(config)
        results = crawler.parse(html)

        self.assertEqual(results[0]["image_src"], "http://example.com/test.jpg")

    def test_parse_anchor_items_with_regex_fields(self):
        config = {
            "url": "https://www.evo.com/shop/ski/skis/blizzard",
            "items_selector": "a[href^='/skis/']",
            "fields": {
                "name": {"regex": "^(.*?)\\s+\\$"},
                "brand": {"regex": "^([A-Za-z0-9'\\.\\-]+)"},
                "price": {"regex": "(\\$[0-9,]+(?:\\.\\d{2})?(?:\\s+\\$[0-9,]+(?:\\.\\d{2})?)?)"},
                "link": {"attribute": "href"}
            }
        }
        html = """
        <a href="/skis/blizzard-zero-g-105-skis-2026">Blizzard Zero G 105 Skis 2026 $949.99</a>
        """
        crawler = GenericCrawler(config)
        results = crawler.parse(html)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Blizzard Zero G 105 Skis 2026")
        self.assertEqual(results[0]["brand"], "Blizzard")
        self.assertEqual(results[0]["price"], "$949.99")
        self.assertEqual(results[0]["link"], "https://www.evo.com/skis/blizzard-zero-g-105-skis-2026")

    @patch('requests.get')
    def test_fetch_success(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "<html></html>"
        mock_get.return_value = mock_response

        config = {"url": "http://example.com"}
        crawler = GenericCrawler(config)
        html = crawler.fetch()

        self.assertEqual(html, "<html></html>")
        mock_get.assert_called_once_with("http://example.com", headers=crawler.headers)

    def test_run_falls_back_to_base_url_when_search_url_has_no_items(self):
        config = {
            "url": "http://example.com/base",
            "search_url": "http://example.com/search?q={query}"
        }
        crawler = GenericCrawler(config)

        with patch.object(crawler, "_fetch_url", side_effect=["<search></search>", "<base></base>"]) as mock_fetch:
            with patch.object(crawler, "parse", side_effect=[[], [{"name": "Item A"}]]):
                results = crawler.run(query="abc")

        self.assertEqual(results, [{"name": "Item A"}])
        self.assertEqual(mock_fetch.call_args_list[0].args[0], "http://example.com/search?q=abc")
        self.assertEqual(mock_fetch.call_args_list[1].args[0], "http://example.com/base")

    def test_run_keeps_search_results_when_available(self):
        config = {
            "url": "http://example.com/base",
            "search_url": "http://example.com/search?q={query}"
        }
        crawler = GenericCrawler(config)

        with patch.object(crawler, "_fetch_url", return_value="<search></search>") as mock_fetch:
            with patch.object(crawler, "parse", return_value=[{"name": "Search Result"}]):
                results = crawler.run(query="abc")

        self.assertEqual(results, [{"name": "Search Result"}])
        self.assertEqual(mock_fetch.call_count, 1)
        self.assertEqual(mock_fetch.call_args.args[0], "http://example.com/search?q=abc")

    def test_run_dedupes_results_by_link_when_names_differ(self):
        config = {
            "url": "http://example.com/base",
            "page_param": "page",
            "max_pages": 2
        }
        crawler = GenericCrawler(config)
        first_page = [
            {
                "name": "Salomon QST 106 Skis 2026$639.96Sale-$799.95",
                "price": "$639.96",
                "link": "https://www.evo.com/skis/salomon-qst-106",
            }
        ]
        second_page = [
            {
                "name": "Salomon QST 106 Skis 20264.77 Reviews$639.96Sale-$799.95",
                "price": "$639.96",
                "link": "https://www.evo.com/skis/salomon-qst-106",
            }
        ]

        with patch.object(crawler, "_fetch_url", side_effect=["<page1></page1>", "<page2></page2>"]):
            with patch.object(crawler, "parse", side_effect=[first_page, second_page]):
                results = crawler.run()

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["link"], "https://www.evo.com/skis/salomon-qst-106")

if __name__ == '__main__':
    unittest.main()
