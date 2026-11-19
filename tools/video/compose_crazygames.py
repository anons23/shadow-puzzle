"""CrazyGames preview videos: static cover as the first frame, then pure gameplay; no sound, no text.
Usage: compose_crazygames.py <frames_dir> <cover.png> <out.mp4> <W> <H>"""
import os, subprocess, sys
from PIL import Image

frames, cover, out, W, H = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
FPS, HOLD, FADE, MAX_S = 30, 30, 9, 20
files = sorted(f for f in os.listdir(frames) if f.endswith('.jpg'))
files = files[:MAX_S * FPS - HOLD - 6]
cv = Image.open(cover).convert('RGB').resize((W, H), Image.LANCZOS)
p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                      '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
for _ in range(HOLD):
    p.stdin.write(cv.tobytes())
for i, f in enumerate(files):
    im = Image.open(os.path.join(frames, f)).convert('RGB')
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    if i < FADE:
        im = Image.blend(cv, im, (i + 1) / (FADE + 1))
    p.stdin.write(im.tobytes())
p.stdin.close(); p.wait()
print(out, round((HOLD + len(files)) / FPS, 1), 's,', round(os.path.getsize(out) / 1e6, 1), 'MB')
