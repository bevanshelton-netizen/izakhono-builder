from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/ready':
            body = json.dumps({
                'ok': True,
                'service': 'StudyPal Alpha Canary',
                'purpose': 'IZAKHONO reusable-pipeline proof'
            }).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == '/':
            body = b'StudyPal Alpha Canary - technical pipeline proof only'
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        return


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', 8091), Handler).serve_forever()
