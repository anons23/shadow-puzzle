"""Renders store art for Yandex Games into store/yandex/ (needs Playwright + Chrome)."""
import asyncio, base64, os, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'store', 'yandex')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
PORT = 8790

ART = [('icon', 'ru', 'icon-512.png')]
for lang in ('ru', 'en'):
    ART += [('cover', lang, f'cover-800x470-{lang}.png'), ('showcase', lang, f'showcase-1560x520-{lang}.png')]

# (level index, rotation factor, roll factor, extra wait ms, win moment)
SHOTS = [(2, (0.78, 0.8, 0), 0, False), (4, (1, 1, 1), 60, True), (19, (0.82, 0.86, 0.6), 0, False), (51, (0.85, 0.8, 0.7), 0, False)]
VIEWS = {'mobile': dict(viewport={'width': 540, 'height': 960}, device_scale_factor=2, is_mobile=True, has_touch=True),
         'desktop': dict(viewport={'width': 1280, 'height': 720}, device_scale_factor=1.5)}


async def main():
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
            os.makedirs(OUT, exist_ok=True)
            pg = await b.new_page()
            for kind, lang, name in ART:
                await pg.goto(f'http://localhost:{PORT}/tools/promo/promo.html?kind={kind}&lang={lang}')
                data = await pg.wait_for_function('window.__done')
                url = await data.json_value()
                open(os.path.join(OUT, name), 'wb').write(base64.b64decode(url.split(',', 1)[1]))
                print('art', name)
            for lang in ('ru', 'en'):
                for view, opts in VIEWS.items():
                    ctx = await b.new_context(locale={'ru': 'ru-RU', 'en': 'en-US'}[lang], **opts)
                    pg = await ctx.new_page()
                    await pg.goto(f'http://localhost:{PORT}/index.html?unlock=1')
                    await pg.wait_for_timeout(600)
                    await pg.click('#btn-play'); await pg.wait_for_timeout(300)
                    d = os.path.join(OUT, 'screenshots', view, lang); os.makedirs(d, exist_ok=True)
                    for n, (lvl, f, wait, win) in enumerate(SHOTS, 1):
                        await pg.evaluate(f'__sh.startLevel({lvl})'); await pg.wait_for_timeout(400)
                        await pg.evaluate('(f)=>{const s=__sh.state.level.secret;__sh.set(s.ry*f[0],s.rx*f[1],s.rz*f[2])}', list(f))
                        await pg.wait_for_timeout(450 + wait)
                        await pg.screenshot(path=os.path.join(d, f'{n}.png'))
                    print('shots', view, lang)
                    await ctx.close()
            await b.close()
    finally:
        srv.terminate()

asyncio.run(main())
