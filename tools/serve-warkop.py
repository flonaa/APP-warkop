"""Serve the local Warkop POS app and open it in the default browser."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket
import webbrowser


APP_DIR = Path(__file__).resolve().parent.parent / "warkop-pos"
PORT = 8080
URL = f"http://localhost:{PORT}/"


class WarkopServer(ThreadingHTTPServer):
    allow_reuse_address = False

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def main():
    handler = partial(SimpleHTTPRequestHandler, directory=str(APP_DIR))
    try:
        server = WarkopServer(("0.0.0.0", PORT), handler)
    except OSError as error:
        print(f"Server Warkop HCR gagal dijalankan di port {PORT}: {error}")
        return 1

    with server:
        print(f"Warkop HCR berjalan di {URL}", flush=True)
        try:
            addresses = socket.gethostbyname_ex(socket.gethostname())[2]
        except OSError:
            addresses = []
        for address in addresses:
            if not address.startswith("127."):
                print(f"HP (Wi-Fi sama): http://{address}:{PORT}/", flush=True)
        print("Tutup jendela ini untuk menghentikan server.", flush=True)
        webbrowser.open(URL)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
