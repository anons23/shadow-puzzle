"""Renders the title cards used by the video (banner 16:9 and vertical 9:16)."""
import asyncio, base64, os, subprocess, sys, time
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'tools', 'video', 'out')
async def main():
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', '8793', '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
            pg = await b.new_page()
            for kind in ('banner', 'vertical'):
                await pg.goto(f'http://localhost:8793/tools/promo/promo.html?kind={kind}&lang=ru')
                url = await (await pg.wait_for_function('window.__done')).json_value()
                open(os.path.join(OUT, f'card-{kind}.png'), 'wb').write(base64.b64decode(url.split(',', 1)[1]))
            await b.close()
    finally:
        srv.terminate()
asyncio.run(main())
