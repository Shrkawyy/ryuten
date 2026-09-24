"""Serve the local installer on loopback. Does not replace Senpa game servers."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial
import argparse, webbrowser
p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8787);p.add_argument('--open',action='store_true');a=p.parse_args()
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',a.port),partial(SimpleHTTPRequestHandler,directory=str(root)))
url=f'http://127.0.0.1:{a.port}/';print('Local installer:',url)
if a.open:webbrowser.open(url)
try:server.serve_forever()
except KeyboardInterrupt:pass
finally:server.server_close()
