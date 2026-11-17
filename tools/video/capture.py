"""Records gameplay frame by frame with a virtual clock -> tools/video/out/frames/*.jpg + scenes.json."""
import asyncio, json, os, shutil, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'tools', 'video', 'out')
FR = os.path.join(OUT, 'frames')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
PORT = 8792
FPS = 30
DT = 1000 / FPS

CLOCK = """(()=>{let now=0,rafs=[],timers=[],tid=1;
performance.now=()=>now;const D0=1.7e12;Date.now=()=>D0+now;
window.requestAnimationFrame=cb=>{rafs.push(cb);return rafs.length};window.cancelAnimationFrame=()=>{};
window.setTimeout=(cb,ms,...a)=>{const id=tid++;timers.push({id,t:now+(ms||0),cb:()=>cb(...a)});return id};
window.clearTimeout=id=>{timers=timers.filter(x=>x.id!==id)};
window.setInterval=()=>0;window.clearInterval=()=>{};
window.__step=dt=>{now+=dt;const due=timers.filter(x=>x.t<=now);timers=timers.filter(x=>x.t>now);
 due.forEach(x=>{try{x.cb()}catch(e){console.error(e)}});const r=rafs;rafs=[];r.forEach(cb=>{try{cb(now)}catch(e){console.error(e)}})};
})();"""

FINGER = """(()=>{const f=document.createElement('div');f.id='finger';
f.style.cssText='position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,.28);border:2px solid rgba(255,255,255,.75);pointer-events:none;z-index:99;opacity:0;transition:none';
document.body.appendChild(f)})()"""

STEP = """(a)=>{__step(a.dt);const st=__sh.state,f=document.getElementById('finger');
if(a.rot && !st.locked){__sh.set(a.rot[0],a.rot[1],a.rot[2]);const r=document.getElementById('roll');if(r)r.value=a.rot[2];}
if(f){f.style.opacity=a.fo;if(a.fp){f.style.left=a.fp[0]+'px';f.style.top=a.fp[1]+'px'}}
return __sh.state.locked}"""

# level index, after-win hold seconds, bend of the path (fraction of secret + offset)
SCENES = [
    dict(level=2, hold=1.05, bend=(0.35, 0.55, 0, 18, -10, 0)),
    dict(level=4, hold=2.4, bend=(0.5, 0.3, 0, -12, 14, 0)),
    dict(level=19, hold=1.05, bend=(0.45, 0.5, 0.2, 16, 8, 10)),
    dict(level=34, hold=1.05, bend=(0.55, 0.4, 0.3, -14, -12, -8)),
    dict(level=51, hold=1.4, bend=(0.4, 0.6, 0.25, 12, -16, 12)),
]
MOVE_S = 2.7
LEAD_S = 0.45


def ease(t): return t * t * (3 - 2 * t)


def bez(p0, p1, p2, t): return [(1 - t) ** 2 * a + 2 * (1 - t) * t * b + t * t * c for a, b, c in zip(p0, p1, p2)]


async def main():
    shutil.rmtree(FR, ignore_errors=True); os.makedirs(FR)
    srv = subprocess.Popen([sys.executable, '-I', '-m', 'http.server', str(PORT), '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    meta = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
            ctx = await b.new_context(viewport={'width': 540, 'height': 960}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='ru-RU')
            await ctx.add_init_script(CLOCK)
            pg = await ctx.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(f'http://localhost:{PORT}/index.html?unlock=1')
            for _ in range(10): await pg.evaluate('__step(33)')
            await pg.evaluate(FINGER)
            await pg.evaluate("document.getElementById('btn-play').click()")
            box = await pg.locator('#cv').bounding_box()
            cx, cy = box['x'] + box['width'] * 0.55, box['y'] + box['height'] * 0.72
            n = 0
            for sc in SCENES:
                await pg.evaluate(f"__sh.startLevel({sc['level']})")
                sec = await pg.evaluate('(()=>{const s=__sh.state.level.secret;return [s.ry,s.rx,s.rz,__sh.state.level.hasRoll]})()')
                roll = sec[3]; target = [sec[0], sec[1], sec[2] if roll else 0]
                bd = sc['bend']
                mid = [target[0] * bd[0] + bd[3], target[1] * bd[1] + bd[4], (target[2] * bd[2] + bd[5]) if roll else 0]
                start_frame, win_frame = n, None
                total = int((LEAD_S + MOVE_S) * FPS)
                k = 0
                while True:
                    t = (k / FPS - LEAD_S) / MOVE_S
                    if win_frame is None and 0 <= t:
                        rot = bez([0, 0, 0], mid, target, ease(min(1, t)))
                        fo = 1 if t < 0.98 else 0.4
                        fp = [cx + rot[0] * 1.6, cy + rot[1] * 1.3]
                    else:
                        rot, fo, fp = None, (0.85 if (win_frame is None and t > -0.4) else 0), [cx, cy]
                    locked = await pg.evaluate(STEP, {'dt': DT, 'rot': rot, 'fo': fo, 'fp': fp})
                    await pg.screenshot(path=os.path.join(FR, f'{n:05d}.jpg'), type='jpeg', quality=92)
                    n += 1; k += 1
                    if locked and win_frame is None: win_frame = n
                    if win_frame is None and k > total + FPS * 2:
                        raise SystemExit(f"level {sc['level']} never solved")
                    if win_frame is not None and n - win_frame >= sc['hold'] * FPS: break
                meta.append({'level': sc['level'], 'start': start_frame, 'win': win_frame, 'end': n, 'roll': roll})
                print('scene', sc['level'], 'frames', start_frame, '-', n, 'win at', win_frame)
            await b.close()
            if errs: print('PAGE ERRORS', errs[:5])
    finally:
        srv.terminate()
    json.dump({'fps': FPS, 'scenes': meta, 'frames': n}, open(os.path.join(OUT, 'scenes.json'), 'w'), indent=1)

asyncio.run(main())
