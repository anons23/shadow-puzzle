"""Renders CrazyGames covers into store/crazygames/ (needs Playwright + Chrome)."""
import asyncio, base64, os, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'store', 'crazygames')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
PORT = 8791
ART = [('cg-landscape', 'cover-landscape-1920x1080.png'), ('cg-portrait', 'cover-portrait-800x1200.png'), ('cg-square', 'cover-square-800x800.png')]

async def main():
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
            os.makedirs(OUT, exist_ok=True)
            pg = await b.new_page()
            for kind, name in ART:
                await pg.goto(f'http://localhost:{PORT}/tools/promo/promo.html?kind={kind}&lang=en')
                url = await (await pg.wait_for_function('window.__done')).json_value()
                open(os.path.join(OUT, name), 'wb').write(base64.b64decode(url.split(',', 1)[1]))
                print('art', name)
            await b.close()
    finally:
        srv.terminate()

asyncio.run(main())
