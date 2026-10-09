"""Local app server and same-origin YGOProDeck artwork relay."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import argparse
import json
import re

ARTWORK_ROUTE = re.compile(r"/api/artwork/([0-9]{1,12})\.jpg")
MAX_ARTWORK_BYTES = 10 * 1024 * 1024


def fetch_artwork(artwork_id):
    # The browser supplies only an ID: the upstream host and path stay fixed.
    url = f"https://images.ygoprodeck.com/images/cards_cropped/{artwork_id}.jpg"
    request = Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "image/*"})
    with urlopen(request, timeout=15) as response:
        content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        data = response.read(MAX_ARTWORK_BYTES + 1)
    if content_type not in {"image/jpeg", "image/png", "image/webp"} or not data or len(data) > MAX_ARTWORK_BYTES:
        raise ValueError("Invalid upstream artwork response")
    return content_type, data


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript',
                      '.mjs': 'text/javascript', '.json': 'application/json',
                      '.woff2': 'font/woff2', '.ttf': 'font/ttf'}

    def send_json_error(self, status, message):
        data = json.dumps({"error": message}, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urlsplit(self.path).path
        if not path.startswith("/api/artwork/"):
            return super().do_GET()
        match = ARTWORK_ROUTE.fullmatch(path)
        if not match:
            return self.send_json_error(400, "ID illustrazione non valido.")
        try:
            content_type, data = fetch_artwork(match.group(1))
        except HTTPError as error:
            if error.code == 404:
                return self.send_json_error(404, f"Illustrazione {match.group(1)} non disponibile.")
            return self.send_json_error(502, "Servizio illustrazioni non disponibile. Riprova.")
        except (URLError, TimeoutError, OSError, ValueError):
            return self.send_json_error(502, "Impossibile scaricare l’illustrazione. Controlla la connessione e riprova.")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "public, max-age=86400")
        self.end_headers()
        self.wfile.write(data)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parents[1] / 'app'
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(directory)))
    print(f'YuGiOh Proxy Maker: http://127.0.0.1:{args.port}/html/index.html', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
