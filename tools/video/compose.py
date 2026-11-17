"""Builds the promo videos from captured frames: 16:9 (RuStore / VK video) and 9:16 (VK clip).
Run after capture.py and render_art.py. Output: store/rustore/video/*.mp4"""
import json, os, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'tools', 'video', 'out')
DEST = os.path.join(ROOT, 'store', 'rustore', 'video')
FONT_B = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
FONT_M = '/usr/share/fonts/opentype/inter/Inter-Medium.otf'
GOLD, CREAM = (255, 198, 110), (255, 240, 215)
INTRO, OUTRO = 3.0, 3.6

meta = json.load(open(os.path.join(OUT, 'scenes.json')))
FPS, NFR, SCENES = meta['fps'], meta['frames'], meta['scenes']
CAPTIONS = [('Поверни предмет', 'тени на стене подскажут'), ('Поймай тень', 'совпало — и комната вспыхнет'),
            ('Наклон и пары', 'головоломка растёт с тобой'), ('Четыре комнаты', 'свой свет и своя музыка'),
            ('60 уровней', 'от простых до хитрых')]
TOTAL = INTRO + NFR / FPS + OUTRO
WINS = [INTRO + s['win'] / FPS for s in SCENES]


# ---------------------------------------------------------------- audio
def audio(path):
    sr = 44100
    n = int(TOTAL * sr)
    t = np.arange(n) / sr
    out = np.zeros((n, 2))
    rng = np.random.default_rng(4)
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)

    def add(sig, start, pan=0.0):
        i = int(start * sr)
        if i >= n: return
        sig = sig[: n - i]
        out[i:i + len(sig), 0] += sig * (1 - pan) ** 0.5
        out[i:i + len(sig), 1] += sig * (1 + pan) ** 0.5

    def pad(notes, start, dur, vol=0.045):
        m = int(dur * sr); tt = np.arange(m) / sr
        env = np.minimum(1, tt / 2.2) * np.minimum(1, (dur - tt) / 2.6).clip(0)
        for k, note in enumerate(notes):
            for cents, pan in ((-5, -0.4), (5, 0.4)):
                f = hz(note) * 2 ** (cents / 1200)
                w = np.sin(2 * np.pi * f * tt) + np.sin(2 * np.pi * 3 * f * tt) / 9 + np.sin(2 * np.pi * 5 * f * tt) / 25
                add(w * env * vol, start, pan)

    def bell(note, start, vol, decay=1.8, pan=0.0):
        m = int((decay + 0.5) * sr); tt = np.arange(m) / sr
        f = hz(note); s = np.zeros(m)
        for r, a in ((1, 1), (2.01, 0.45), (3.0, 0.2), (4.2, 0.1)):
            s += a * np.sin(2 * np.pi * f * r * tt) * np.exp(-tt * r / decay * 2.2)
        s *= np.minimum(1, tt / 0.004)
        add(s * vol, start, pan)

    def pop(start, vol):
        m = int(rng.uniform(0.006, 0.03) * sr)
        s = np.diff(rng.standard_normal(m + 1)) * np.exp(-np.arange(m) / m * 5)
        add(s * vol, start, rng.uniform(-0.6, 0.6))

    def whoosh(start, vol=0.12):
        m = int(0.9 * sr); x = rng.standard_normal(m)
        a = np.linspace(0.02, 0.35, m)
        y = np.zeros(m); acc = 0.0
        for i in range(m): acc += a[i] * (x[i] - acc); y[i] = acc
        env = np.sin(np.linspace(0, np.pi, m)) ** 2
        add(y * env * vol * 3, start)

    chords = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]]
    k, st = 0, 0.0
    while st < TOTAL:
        pad(chords[k % 4], st, 8.5); k += 1; st += 6.5
    mel = [69, 72, 74, 76, 79, 81]; st = 1.2
    while st < TOTAL - 2:
        if rng.random() < 0.6: bell(int(rng.choice(mel)), st, 0.05, 1.6, rng.uniform(-0.5, 0.5))
        st += rng.uniform(0.9, 2.0)
    st = INTRO
    while st < INTRO + NFR / FPS:
        if rng.random() < 0.3: pop(st, rng.uniform(0.02, 0.08))
        st += 0.06
    for w in WINS:
        whoosh(w - 0.05)
        for j, note in enumerate([69, 72, 76, 81, 84]):
            bell(note, w + 0.08 + j * 0.09, 0.11, 2.2, -0.4 + j * 0.2)
    end = INTRO + NFR / FPS
    pad([57, 64, 69, 72], end, OUTRO + 0.2, 0.05)
    for j, note in enumerate([69, 76, 81]): bell(note, end + 0.2 + j * 0.15, 0.09, 2.6)

    ir_n = int(1.9 * sr); ir = rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / sr * 3.2); ir /= np.abs(ir).sum() ** 0.5 * 6
    L = n + ir_n
    nfft = 1 << (L - 1).bit_length()
    IR = np.fft.rfft(ir, nfft)
    wet = np.stack([np.fft.irfft(np.fft.rfft(out[:, c], nfft) * IR, nfft)[:n] for c in (0, 1)], 1)
    mix = out + wet * 0.35
    fade = np.ones(n); fi, fo = int(0.6 * sr), int(1.2 * sr)
    fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
    mix *= fade[:, None]
    mix /= np.abs(mix).max() / 0.85
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((mix * 32767).astype('<i2').tobytes())


# ---------------------------------------------------------------- video
def font(path, size): return ImageFont.truetype(path, size)


def caption_layer(size, xy, head, sub, hs, ss, align='left'):
    im = Image.new('RGBA', size, (0, 0, 0, 0))
    sh = Image.new('RGBA', size, (0, 0, 0, 0))
    fh, fs = font(FONT_B, hs), font(FONT_M, ss)
    for layer, col_h, col_s, off in ((sh, (0, 0, 0, 170), (0, 0, 0, 170), 4), (im, GOLD + (255,), CREAM + (240,), 0)):
        d = ImageDraw.Draw(layer)
        x, y = xy
        if align == 'center':
            wh = d.textlength(head, font=fh); ws = d.textlength(sub, font=fs)
            d.text((x - wh / 2 + off, y + off), head, font=fh, fill=col_h)
            d.text((x - ws / 2 + off, y + hs * 1.22 + off), sub, font=fs, fill=col_s)
        else:
            d.text((x + off, y + off), head, font=fh, fill=col_h)
            d.text((x + off, y + hs * 1.22 + off), sub, font=fs, fill=col_s)
    sh = sh.filter(ImageFilter.GaussianBlur(hs * 0.12))
    return Image.alpha_composite(sh, im)


def pill(size, center, text, fs):
    im = Image.new('RGBA', size, (0, 0, 0, 0)); d = ImageDraw.Draw(im); f = font(FONT_B, fs)
    w = d.textlength(text, font=f); pw, ph = w + fs * 1.6, fs * 2.0
    x0, y0 = center[0] - pw / 2, center[1] - ph / 2
    d.rounded_rectangle((x0, y0, x0 + pw, y0 + ph), radius=ph / 2, fill=(28, 18, 10, 215), outline=GOLD + (255,), width=max(2, fs // 14))
    d.text((center[0] - w / 2, y0 + (ph - fs * 1.2) / 2), text, font=f, fill=GOLD + (255,))
    return im


def phone(frame, h, radius):
    w = round(frame.width * h / frame.height)
    fr = frame.resize((w, h), Image.LANCZOS).convert('RGBA')
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), radius=radius, fill=255)
    fr.putalpha(m)
    return fr


def build(kind, wav):
    W, H = (1920, 1080) if kind == 'h' else (1080, 1920)
    card = Image.open(os.path.join(OUT, 'card-banner.png' if kind == 'h' else 'card-vertical.png')).convert('RGB')
    bg = card.filter(ImageFilter.GaussianBlur(22))
    bg = Image.blend(bg, Image.new('RGB', bg.size, (10, 6, 3)), 0.5)
    if kind == 'h':
        ph_h = 930; ph_xy = (1040, 75); radius = 34
        caps = [caption_layer((W, H), (200, 420), a, b, 84, 40) for a, b in CAPTIONS]
        cta = pill((W, H), (560, 860), 'Скачай в RuStore', 46)
    else:
        ph_h = 1420; ph_xy = None; radius = 46
        caps = [caption_layer((W, H), (W // 2, 205), a, b, 82, 40, 'center') for a, b in CAPTIONS]
        cta = pill((W, H), (W // 2, 1480), 'Скачай в RuStore', 54)
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    out = os.path.join(DEST, f"shadows-{'16x9' if kind == 'h' else '9x16'}.mp4")
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-i', wav, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
           '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    n_in, n_out = int(INTRO * FPS), int(OUTRO * FPS)

    def emit(img): p.stdin.write(img.convert('RGB').tobytes())

    for i in range(n_in):
        z = 1 + 0.035 * i / n_in
        cw, ch = int(W / z), int(H / z)
        f = card.crop(((W - cw) // 2, (H - ch) // 2, (W + cw) // 2, (H + ch) // 2)).resize((W, H), Image.BILINEAR)
        a = min(1, i / (0.6 * FPS)); f = Image.blend(Image.new('RGB', (W, H)), f, a)
        tail = (i - (n_in - 0.4 * FPS)) / (0.4 * FPS)
        if tail > 0: f = Image.blend(f, bg, min(1, tail))
        emit(f)
    pw = round(1080 * ph_h / 1920)
    if ph_xy is None: ph_xy = ((W - pw) // 2, 400)
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((ph_xy[0] - 6, ph_xy[1] + 14, ph_xy[0] + pw + 6, ph_xy[1] + ph_h + 22), radius=radius + 8, fill=(0, 0, 0, 170))
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    base = Image.alpha_composite(bg.convert('RGBA'), shadow)
    border = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle((ph_xy[0] - 3, ph_xy[1] - 3, ph_xy[0] + pw + 2, ph_xy[1] + ph_h + 2), radius=radius + 3, outline=GOLD + (110,), width=3)
    for fi in range(NFR):
        si = max(j for j, s in enumerate(SCENES) if s['start'] <= fi)
        s = SCENES[si]
        fr = Image.open(os.path.join(OUT, 'frames', f'{fi:05d}.jpg'))
        img = base.copy()
        img.alpha_composite(phone(fr, ph_h, radius), ph_xy)
        img.alpha_composite(border)
        local = (fi - s['start']) / FPS
        a = min(1, local / 0.35) * min(1, (s['end'] - fi) / (0.25 * FPS))
        dy = int((1 - min(1, local / 0.35)) * 18)
        if a > 0:
            cap = caps[si]
            if a < 1:
                cap = cap.copy(); cap.putalpha(cap.getchannel('A').point(lambda v: int(v * a)))
            layer = Image.new('RGBA', (W, H), (0, 0, 0, 0)); layer.alpha_composite(cap, (0, dy))
            img.alpha_composite(layer)
        if 0 <= fi - s['start'] < 4 and si > 0:
            img = Image.blend(img, Image.new('RGBA', (W, H), (0, 0, 0, 255)), 0.5 * (1 - (fi - s['start']) / 4))
        emit(img)
    for i in range(n_out):
        a = min(1, i / (0.5 * FPS))
        f = Image.blend(bg, card, a).convert('RGBA')
        ca = min(1, max(0, (i - 0.6 * FPS) / (0.4 * FPS)))
        if ca > 0:
            c = cta.copy(); c.putalpha(c.getchannel('A').point(lambda v: int(v * ca))); f.alpha_composite(c)
        out_a = min(1, max(0, (i - (n_out - 0.7 * FPS)) / (0.7 * FPS)))
        if out_a > 0: f = Image.blend(f, Image.new('RGBA', (W, H), (0, 0, 0, 255)), out_a)
        emit(f)
    p.stdin.close(); p.wait()
    return out


if __name__ == '__main__':
    os.makedirs(DEST, exist_ok=True)
    wav = os.path.join(OUT, 'music.wav')
    audio(wav)
    print('audio', round(TOTAL, 2), 's')
    for k in ('h', 'v'):
        print('video', build(k, wav))
