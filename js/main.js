import { rotateFaces, shadowPolys, rasterize, iou } from './engine.js';
import { getLevel, LEVEL_COUNT, THEMES } from './levels.js';
import { Ads } from './ads.js';

const W = 360, H = 560, TABLE_Y = 150, WALL_Y = 420, S_TABLE = 50, S_WALL = 56;
const $ = (id) => document.getElementById(id);
const KEY = 'shadows.v1';
let save = { stars: [], sound: true };
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) save = Object.assign(save, s); } catch (e) {}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }

let actx = null;
function tone(freq, dur, type, vol) {
  if (!save.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq; g.gain.value = vol || 0.08;
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
  } catch (e) {}
}

function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id)); }

const cv = $('cv'), ctx = cv.getContext('2d');
let scale = 1, dpr = 1;
function resize() {
  const st = $('stage'), w = st.clientWidth, h = st.clientHeight;
  if (!w || !h) return;
  scale = Math.min(w / W, h / H); dpr = window.devicePixelRatio || 1;
  cv.style.width = W * scale + 'px'; cv.style.height = H * scale + 'px';
  cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
}
window.addEventListener('resize', () => { resize(); draw(); });

let level = null, theme = THEMES[0];
let ry = 0, rx = 0, match = 0, ghost = false, hintUsed = false, t0 = 0, moves = 0, finished = 0, locked = false;

function applyTheme(t) {
  theme = t;
  const r = document.documentElement.style;
  r.setProperty('--bg', t.bg); r.setProperty('--fg', t.fg); r.setProperty('--soft', t.soft);
  r.setProperty('--accent', t.line); r.setProperty('--dot', t.obj);
  document.querySelector('meta[name=theme-color]').setAttribute('content', t.bg);
}

function setStatus(t) { $('hud-status').textContent = t; }

function recompute() {
  match = iou(rasterize(shadowPolys(level.model, ry, rx)), level.grid);
  $('hud-meta').textContent = Math.round(match * 100) + '%';
}

function startLevel(i) {
  level = getLevel(i);
  applyTheme(THEMES[level.theme]);
  ry = 0; rx = 0; ghost = false; hintUsed = false; moves = 0; locked = false; t0 = Date.now();
  $('hud-level').textContent = 'Уровень ' + (i + 1);
  $('win').classList.add('hidden');
  setStatus(level.name + ': подгони тень под контур');
  show('screen-game'); resize(); recompute(); draw();
}

function rr(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function path(pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }
const tableXY = (p) => [W / 2 + (p[0] + 0.35 * p[2]) * S_TABLE, TABLE_Y - (p[1] + 0.25 * p[2]) * S_TABLE];
const wallXY = (p) => [W / 2 + p[0] * S_WALL, WALL_Y - p[1] * S_WALL];

function buildTarget() {
  const k = 2, size = Math.round(4.4 * S_WALL * k), el = document.createElement('canvas');
  el.width = size; el.height = size;
  const c = el.getContext('2d');
  c.fillStyle = theme.line; c.strokeStyle = theme.line; c.lineWidth = 1; c.lineJoin = 'round';
  shadowPolys(level.model, level.secret.ry, level.secret.rx).forEach((poly) => {
    c.beginPath();
    poly.forEach((p, i) => { const x = (p[0] + 2.2) * S_WALL * k, y = (2.2 - p[1]) * S_WALL * k; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.closePath(); c.fill(); c.stroke();
  });
  level.tcv = { el, theme };
}

function draw() {
  if (!level) return;
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = theme.soft; rr(6, 6, W - 12, 276, 14); ctx.fill();
  ctx.fillStyle = theme.wallbg; rr(6, 290, W - 12, 264, 14); ctx.fill();
  ctx.fillStyle = theme.fg; ctx.globalAlpha = 0.5; ctx.font = '12px sans-serif';
  ctx.fillText('Стол', 16, 24); ctx.fillText('Стена', 16, 308); ctx.globalAlpha = 1;
  ctx.lineJoin = 'round';

  if (!level.tcv || level.tcv.theme !== theme) buildTarget();
  ctx.globalAlpha = 0.32;
  ctx.drawImage(level.tcv.el, W / 2 - 2.2 * S_WALL, WALL_Y - 2.2 * S_WALL, 4.4 * S_WALL, 4.4 * S_WALL);
  ctx.globalAlpha = 1;

  const cur = shadowPolys(level.model, ry, rx);
  ctx.fillStyle = theme.shadow; ctx.globalAlpha = 0.88;
  cur.forEach((poly) => { path(poly.map((p) => wallXY([p[0], p[1]]))); ctx.fill(); });
  ctx.globalAlpha = 1;

  if (ghost) {
    ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = theme.line;
    rotateFaces(level.model, level.secret.ry, level.secret.rx).forEach((f) => { path(f.map(tableXY)); ctx.stroke(); });
    ctx.setLineDash([]);
  }
  const faces = rotateFaces(level.model, ry, rx);
  const order = faces.map((f, i) => [f.reduce((s, p) => s + p[2], 0) / f.length, i]).sort((a, b) => b[0] - a[0]);
  ctx.lineWidth = 1.2;
  order.forEach(([, i]) => {
    const f = faces[i];
    const ux = f[1][0] - f[0][0], uy = f[1][1] - f[0][1], uz = f[1][2] - f[0][2];
    const vx = f[2][0] - f[0][0], vy = f[2][1] - f[0][1], vz = f[2][2] - f[0][2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; ny /= l; nz /= l; nx /= l;
    const lit = 0.55 + 0.45 * Math.abs(nx * -0.4 + ny * 0.7 + nz * -0.6);
    path(f.map(tableXY));
    ctx.globalAlpha = 0.5 + 0.5 * lit; ctx.fillStyle = theme.obj; ctx.fill();
    ctx.globalAlpha = 0.35; ctx.strokeStyle = theme.bg; ctx.stroke(); ctx.globalAlpha = 1;
  });
  ctx.fillStyle = theme.fg; ctx.globalAlpha = 0.9; ctx.font = '500 15px sans-serif';
  ctx.fillText(Math.round(match * 100) + '%', W - 52, 308); ctx.globalAlpha = 1;
}

function clamp() { ry = Math.max(-120, Math.min(120, ry)); rx = Math.max(-100, Math.min(100, rx)); }
function changed() { clamp(); recompute(); draw(); }

let drag = null;
cv.addEventListener('pointerdown', (e) => { if (locked) return; drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => {
  if (!drag || locked) return;
  const k = 0.55 / scale;
  ry += (e.clientX - drag.x) * k; rx += (e.clientY - drag.y) * k;
  drag.x = e.clientX; drag.y = e.clientY; moves++; changed();
});
function release() { if (!drag) return; drag = null; check(); }
cv.addEventListener('pointerup', release);
cv.addEventListener('pointercancel', release);

function nudge(dy, dx) { if (locked) return; ry += dy; rx += dx; moves++; changed(); check(); }
$('btn-left').onclick = () => nudge(-1.5, 0);
$('btn-right').onclick = () => nudge(1.5, 0);
$('btn-up').onclick = () => nudge(0, -1.5);
$('btn-down').onclick = () => nudge(0, 1.5);

function check() {
  if (locked || match < level.thr) return;
  locked = true;
  ry = level.secret.ry; rx = level.secret.rx; recompute(); draw();
  const secs = (Date.now() - t0) / 1000;
  const stars = hintUsed ? 1 : secs < 45 ? 3 : 2;
  const i = level.index;
  save.stars[i] = Math.max(save.stars[i] || 0, stars); persist(); finished++;
  [523, 659, 784].forEach((f, k) => setTimeout(() => tone(f, 0.25, 'sine', 0.1), k * 130));
  $('win-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('win-info').textContent = 'Время: ' + Math.round(secs) + ' с';
  $('win-next').textContent = i + 1 < LEVEL_COUNT ? 'Дальше' : 'К списку уровней';
  setStatus('Тень совпала');
  setTimeout(() => $('win').classList.remove('hidden'), 450);
}

$('win-next').onclick = async () => {
  const i = level.index;
  if (finished % 3 === 0) await Ads.showInterstitial();
  if (i + 1 < LEVEL_COUNT) startLevel(i + 1); else openLevels();
};
$('win-retry').onclick = () => startLevel(level.index);

$('btn-hint').onclick = async () => {
  if (locked || ghost) return;
  const ok = await Ads.showRewarded();
  if (!ok) { setStatus('Награда не получена'); return; }
  hintUsed = true; ghost = true;
  setStatus('Пунктир на столе показывает нужное положение');
  draw();
};

function openLevels() {
  const grid = $('level-grid');
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const open = i === 0 || save.stars[i - 1] > 0;
    const b = document.createElement('button');
    b.className = 'cell' + (open ? '' : ' locked');
    const s = save.stars[i] || 0;
    b.innerHTML = (i + 1) + '<small>' + (open ? '★'.repeat(s) + '☆'.repeat(3 - s) : '—') + '</small>';
    if (open) b.onclick = () => startLevel(i);
    grid.appendChild(b);
  }
  applyTheme(THEMES[1]); show('screen-levels');
}
function firstOpen() { for (let i = 0; i < LEVEL_COUNT; i++) if (!(save.stars[i] > 0)) return i; return LEVEL_COUNT - 1; }

$('btn-play').onclick = () => startLevel(firstOpen());
$('btn-levels').onclick = openLevels;
$('levels-back').onclick = () => { applyTheme(THEMES[1]); show('screen-menu'); };
$('game-back').onclick = () => { applyTheme(THEMES[1]); show('screen-menu'); };
function soundLabel() { $('btn-sound').textContent = 'Звук: ' + (save.sound ? 'вкл' : 'выкл'); }
$('btn-sound').onclick = () => { save.sound = !save.sound; persist(); soundLabel(); tone(440, 0.1); };
soundLabel(); applyTheme(THEMES[1]);

window.__sh = { startLevel, set(a, b) { ry = a; rx = b; changed(); check(); }, get state() { return { ry, rx, match, locked, level }; } };
