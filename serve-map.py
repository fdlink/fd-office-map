#!/usr/bin/env python3
"""Serve the Stage 0 map with CORS. play.workadventu.re fetches the .tmj
cross-origin, and a plain http.server sends no Access-Control-Allow-Origin,
so the map silently never loads."""
import os, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class CORS(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def guess_type(self, path):
        if path.endswith(".tmj"):
            return "application/json"
        return super().guess_type(path)

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f"map on http://localhost:{port}/office.tmj (CORS open)")
    ThreadingHTTPServer(("0.0.0.0", port), CORS).serve_forever()
