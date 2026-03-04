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

if __name__ == '__main__':
    unittest.main()
