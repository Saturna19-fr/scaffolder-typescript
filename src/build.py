#!/usr/bin/env python3
"""Assemble index.html from src/template.html, src/app.js and data/*.json."""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def read(p): return open(os.path.join(ROOT, p), encoding='utf-8').read()

tpl = read('src/template.html')
app = read('src/app.js')

def embed(path):
    # compact JSON, and make it safe inside a <script type="application/json"> block
    data = json.dumps(json.loads(read(path)), ensure_ascii=False, separators=(',', ':'))
    # '<' only ever occurs inside JSON strings here, so \u003c is a valid escape
    # and makes '</script' or '<!--' impossible inside the embedded block.
    return data.replace('<', '\\u003c')

out = (tpl
       .replace('__TS_DATA__', embed('data/ts-data.json'))
       .replace('__OX_CONFIG__', embed('data/ox-config.json'))
       .replace('__OX_RULES__', embed('data/ox-rules.json'))
       .replace('__APP_JS__', app))

dest = os.path.join(ROOT, 'index.html')
open(dest, 'w', encoding='utf-8').write(out)
print('index.html written: %.1f KB' % (os.path.getsize(dest) / 1024))
