"""Builds dist/<name>-crazygames.zip for CrazyGames: CrazyGames SDK v3 tag in index.html,
all levels locked (TEST_UNLOCK_ALL = false). Store art, tools and Android files are not included."""
import os, re, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAME = sys.argv[1] if len(sys.argv) > 1 else os.path.basename(ROOT)
OUT = os.path.join(ROOT, 'dist', NAME + '-crazygames.zip')
SDK = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>'

def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    html = read('index.html')
    html = re.sub(r'\s*<script src="/sdk\.js"></script>', '', html)
    html = html.replace('</head>', '  <script>window.__CG_BUILD = 1;</script>\n  ' + SDK + '\n</head>', 1)
    z.writestr('index.html', html)
    for item in ['css', 'js', 'assets']:
        path = os.path.join(ROOT, item)
        if not os.path.isdir(path):
            continue
        for base, _, files in os.walk(path):
            for f in sorted(files):
                full = os.path.join(base, f)
                rel = os.path.relpath(full, ROOT).replace(os.sep, '/')
                if rel == 'js/main.js':
                    src = read(rel)
                    assert 'TEST_UNLOCK_ALL = true' in src or 'TEST_UNLOCK_ALL = false' in src
                    z.writestr(rel, src.replace('TEST_UNLOCK_ALL = true', 'TEST_UNLOCK_ALL = false'))
                else:
                    z.write(full, rel)
    names = z.namelist()
print(OUT, '-', len(names), 'files,', round(os.path.getsize(OUT) / 1024), 'KB')
