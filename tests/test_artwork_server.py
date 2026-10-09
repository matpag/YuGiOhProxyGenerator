"""Exercise the actual local HTTP relay without depending on the external CDN."""
import importlib.util
import io
import json
from functools import partial
from pathlib import Path
from threading import Thread
from unittest import TestCase, main
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from urllib.request import urlopen
from http.server import ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("proxy_serve", ROOT / "scripts/serve.py")
serve = importlib.util.module_from_spec(spec)
spec.loader.exec_module(serve)


class ImageResponse(io.BytesIO):
    def __init__(self, body=b"test-image", content_type="image/jpeg"):
        super().__init__(body)
        self.headers = {"Content-Type": content_type}


class QuietHandler(serve.Handler):
    def log_message(self, *_):
        pass


class ArtworkRelayTests(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT / "app")))
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.origin = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def get(self, path):
        try:
            response = urlopen(self.origin + path, timeout=2)
        except HTTPError as error:
            response = error
        with response:
            return response.code, response.headers, response.read()

    def test_image_is_relayed_from_the_fixed_cropped_endpoint(self):
        with patch.object(serve, "urlopen", return_value=ImageResponse()) as upstream:
            code, headers, data = self.get("/api/artwork/31924889.jpg")
        self.assertEqual((code, headers["Content-Type"], data), (200, "image/jpeg", b"test-image"))
        self.assertEqual(headers["Content-Length"], str(len(data)))
        self.assertEqual(upstream.call_args.args[0].full_url, "https://images.ygoprodeck.com/images/cards_cropped/31924889.jpg")
        self.assertEqual(upstream.call_args.kwargs["timeout"], 15)

    def test_only_numeric_artwork_ids_are_forwarded(self):
        with patch.object(serve, "urlopen") as upstream:
            for path in ["/api/artwork/https://example.com.jpg", "/api/artwork/1234567890123.jpg", "/api/artwork/../123.jpg", "/api/artwork/nope.jpg"]:
                self.assertEqual(self.get(path)[0], 400)
        upstream.assert_not_called()

    def test_missing_artwork_returns_json_without_cache(self):
        with patch.object(serve, "urlopen", side_effect=HTTPError("upstream", 404, "Missing", {}, None)):
            code, headers, data = self.get("/api/artwork/31924889.jpg")
        self.assertEqual(code, 404)
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertIn("31924889", json.loads(data)["error"])

    def test_unavailable_upstream_returns_an_actionable_error(self):
        for error in [URLError("offline"), TimeoutError(), HTTPError("upstream", 429, "Rate limited", {}, None)]:
            with self.subTest(error=type(error).__name__), patch.object(serve, "urlopen", side_effect=error):
                code, headers, data = self.get("/api/artwork/31924889.jpg")
            self.assertEqual(code, 502)
            self.assertEqual(headers["Cache-Control"], "no-store")
            self.assertIn("riprova", json.loads(data)["error"].lower())

    def test_html_or_empty_responses_do_not_become_artwork(self):
        for response in [ImageResponse(b"<html>blocked</html>", "text/html"), ImageResponse(b"")]:
            with patch.object(serve, "urlopen", return_value=response):
                self.assertEqual(self.get("/api/artwork/31924889.jpg")[0], 502)

    def test_static_app_and_javascript_routes_remain_available(self):
        self.assertEqual(self.get("/html/index.html")[0], 200)
        code, headers, _ = self.get("/js/main.js")
        self.assertEqual(code, 200)
        self.assertEqual(headers["Content-Type"], "text/javascript")


if __name__ == "__main__":
    main()
