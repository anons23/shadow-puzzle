"""Builds dist/shadows-yandex.zip for Yandex Games: index.html at the root plus css/ and js/."""
import os, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'shadows-yandex.zip')
INCLUDE = ['index.html', 'css', 'js', 'assets']

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    for item in INCLUDE:
        path = os.path.join(ROOT, item)
        if os.path.isfile(path):
            z.write(path, item)
        elif os.path.isdir(path):
            for base, _, files in os.walk(path):
                for f in sorted(files):
                    full = os.path.join(base, f)
                    z.write(full, os.path.relpath(full, ROOT).replace(os.sep, '/'))
    names = z.namelist()
print(OUT, '-', len(names), 'files,', round(os.path.getsize(OUT) / 1024), 'KB')
