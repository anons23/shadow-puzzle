"""Renders RuStore art into store/rustore/ (needs Playwright, Chrome and Pillow)."""
import asyncio, base64, io, os, subprocess, sys, time
from PIL import Image
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'store', 'rustore')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
PORT = 8791
# (level index, rotation factors, extra wait ms)
SHOTS = [(2, (0.78, 0.8, 0), 0), (4, (1, 1, 1), 60), (19, (0.82, 0.86, 0.6), 0), (34, (0.84, 0.82, 0.7), 0), (51, (0.85, 0.8, 0.7), 0)]


def save_opaque(png_bytes, path, jpg=False):
    im = Image.open(io.BytesIO(png_bytes)).convert('RGB')
    if jpg: im.save(path, 'JPEG', quality=92, optimize=True)
    else: im.save(path, 'PNG', optimize=True)
    return os.path.getsize(path)


async def main():
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
            os.makedirs(os.path.join(OUT, 'screenshots', 'phone'), exist_ok=True)
            pg = await b.new_page()
            for kind, name in [('icon', 'icon-512.png'), ('banner', 'background-1920x1080.png')]:
                await pg.goto(f'http://localhost:{PORT}/tools/promo/promo.html?kind={kind}&lang=ru')
                url = await (await pg.wait_for_function('window.__done')).json_value()
                kb = save_opaque(base64.b64decode(url.split(',', 1)[1]), os.path.join(OUT, name)) // 1024
                print(name, kb, 'KB')
            ctx = await b.new_context(viewport={'width': 540, 'height': 960}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='ru-RU')
            pg = await ctx.new_page()
            await pg.goto(f'http://localhost:{PORT}/index.html?unlock=1'); await pg.wait_for_timeout(600)
            await pg.click('#btn-play'); await pg.wait_for_timeout(300)
            for n, (lvl, f, wait) in enumerate(SHOTS, 1):
                await pg.evaluate(f'__sh.startLevel({lvl})'); await pg.wait_for_timeout(400)
                await pg.evaluate('(f)=>{const s=__sh.state.level.secret;__sh.set(s.ry*f[0],s.rx*f[1],s.rz*f[2])}', list(f))
                await pg.wait_for_timeout(450 + wait)
                kb = save_opaque(await pg.screenshot(), os.path.join(OUT, 'screenshots', 'phone', f'{n}.jpg'), jpg=True) // 1024
                print('phone', n, kb, 'KB')
            await b.close()
    finally:
        srv.terminate()

asyncio.run(main())
