import { rotateFaces, shadowPolys, rasterize, iou } from './engine.js';
import { getLevel, getDaily, dayNumber, todayKey, LEVEL_COUNT, THEMES, METER_LEVELS, ROLL_FROM } from './levels.js';
import { Analytics } from './analytics.js';
import { Platform } from './platform.js';
import { t, setLang, applyStatic } from './i18n.js';
import { Sound } from './audio.js';

const W = 360, H = 560, WALL_H = 330;
const SX = 180, SY = 182, S_WALL = 50;
const OX = 200, OY = 440, S_OBJ = 44;
const CANDLE = { x: 54, y: 548 };
const $ = (id) => document.getElementById(id);
// TODO перед релизом: поставить TEST_UNLOCK_ALL = false
const TEST_UNLOCK_ALL = true;
const UNLOCK_ALL = TEST_UNLOCK_ALL || /[?&]unlock=1/.test(location.search);
const makeDefaults = () => ({ stars: [], sound: true, music: true, freeHints: 0, daily: { last: '', streak: 0, best: 0 } });
let save = makeDefaults();
function persist() { Platform.writeSave(save); }
function levelName(L) { return L.keys.map((k) => t('obj.' + k)).join(' + '); }

function buzz(ms) { try { if (save.sound && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  Sound.setScene(id === 'screen-game');
  if (id !== 'screen-game') { Platform.gameplay(false); clearTimeout(winTimer); $('win').classList.add('hidden'); }
}

function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; }
function rgba(c, a) { return 'rgba(' + hex(c).join(',') + ',' + a + ')'; }

const cv = $('cv'), ctx = cv.getContext('2d');
const CAN_FILTER = 'filter' in ctx;
let scale = 1, dpr = 1, bgCache = null, shadowLayer = null;
function resize() {
  const st = $('stage'), w = st.clientWidth, h = st.clientHeight;
  if (!w || !h) return;
  scale = Math.min(w / W, h / H); dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  cv.style.width = W * scale + 'px'; cv.style.height = H * scale + 'px';
  cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
  bgCache = null; shadowLayer = null; if (level) level.tcv = null;
}
window.addEventListener('resize', () => { resize(); draw(); });

function layer() {
  const c = document.createElement('canvas');
  c.width = cv.width; c.height = cv.height;
  const x = c.getContext('2d');
  x.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  return { c, x };
}
function pathOn(c, pts) { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); }
function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
const tableXY = (p) => [OX + (p[0] + 0.35 * p[2]) * S_OBJ, OY - (p[1] + 0.25 * p[2]) * S_OBJ];
const wallXY = (p) => [SX + p[0] * S_WALL, SY - p[1] * S_WALL];

let level = null, theme = THEMES[0];
let ry = 0, rx = 0, rz = 0, match = 0, ghost = false, hintUsed = false, t0 = 0, moves = 0, finished = 0, locked = false;
let winAt = 0, sparks = [], dust = [], winTimer = 0;

function applyTheme(t) {
  if (theme !== t) bgCache = null;
  theme = t;
  const r = document.documentElement.style;
  r.setProperty('--bg', t.bg); r.setProperty('--fg', t.fg); r.setProperty('--soft', t.soft);
  r.setProperty('--accent', t.line); r.setProperty('--dot', t.line);
  document.querySelector('meta[name=theme-color]').setAttribute('content', t.bg);
}

function setStatus(t) { $('hud-status').textContent = t; }

function recompute() {
  match = iou(rasterize(shadowPolys(level.model, ry, rx, rz)), level.grid);
  $('hud-meta').textContent = level.meter ? Math.round(match * 100) + '%' : '';
}

function seedDust() {
  dust = [];
  for (let i = 0; i < 26; i++) dust.push({ x: 20 + Math.random() * 320, y: 30 + Math.random() * 480, vx: (Math.random() - 0.5) * 0.06, vy: -0.03 - Math.random() * 0.08, r: 0.7 + Math.random() * 1.1, ph: Math.random() * 6.28 });
}

function yesterdayKey() { const d = new Date(); d.setDate(d.getDate() - 1); return todayKey(d); }
function maxReached() { let m = 0; save.stars.forEach((s, i) => { if (s > 0) m = i + 1; }); return m; }
function hintLabel() { $('btn-hint').textContent = save.freeHints > 0 ? t('hintFree', { n: save.freeHints }) : t('hint'); }

function startDaily() {
  clearTimeout(winTimer);
  level = getDaily(dayNumber());
  level.tcv = null;
  setupLevel();
  $('hud-level').textContent = t('daily');
  setStatus(t('dailyGoal', { name: levelName(level) }));
  Analytics.event('daily_start', { day: level.dayIdx });
  enterGame();
}

function setupLevel() {
  applyTheme(THEMES[level.theme]);
  Sound.setRoom(level.theme);
  ry = 0; rx = 0; rz = 0; ghost = false; hintUsed = false; moves = 0; locked = false; t0 = Date.now(); winAt = 0; sparks = [];
  $('roll').value = 0;
  $('roll-row').classList.toggle('hidden', !level.hasRoll);
  $('win').classList.add('hidden');
  hintLabel();
}

function enterGame() {
  show('screen-game'); resize(); seedDust(); recompute(); draw();
  Platform.gameplay(true);
}

function startLevel(i) {
  clearTimeout(winTimer);
  level = getLevel(i);
  level.tcv = null;
  setupLevel();
  $('hud-level').textContent = t('level', { n: i + 1, m: LEVEL_COUNT });
  Analytics.event('level_start', { level: i + 1 });
  if (i === METER_LEVELS) setStatus(t('noMeter'));
  else if (i === ROLL_FROM) setStatus(t('newTilt'));
  else if (i % 15 === 0 && i > 0) setStatus(t('newRoom', { name: t('room.' + level.theme) }));
  else setStatus(t('goal', { name: levelName(level) }));
  enterGame();
}

function buildBg() {
  const { c, x } = layer();
  x.fillStyle = theme.wall; x.fillRect(0, 0, W, WALL_H);
  x.fillStyle = 'rgba(0,0,0,0.07)';
  for (let i = 0; i < W; i += 22) x.fillRect(i, 0, 11, WALL_H);
  let g = x.createRadialGradient(SX, SY + 10, 10, SX, SY + 10, 250);
  g.addColorStop(0, rgba(theme.wallLit, 0.9)); g.addColorStop(0.5, rgba(theme.wallLit, 0.3)); g.addColorStop(1, rgba(theme.wallLit, 0));
  x.fillStyle = g; x.fillRect(0, 0, W, WALL_H);
  x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(0, WALL_H - 9, W, 9);
  x.fillStyle = rgba(theme.wallLit, 0.25); x.fillRect(0, WALL_H - 10, W, 1.5);
  g = x.createLinearGradient(0, WALL_H, 0, H);
  g.addColorStop(0, theme.table); g.addColorStop(1, theme.tableLit);
  x.fillStyle = g; x.fillRect(0, WALL_H, W, H - WALL_H);
  x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 1;
  for (let k = -7; k <= 7; k++) { x.beginPath(); x.moveTo(SX + k * 26, WALL_H); x.lineTo(SX + k * 74, H); x.stroke(); }
  x.strokeStyle = 'rgba(255,255,255,0.045)';
  for (let i = 0; i < 70; i++) {
    const y = WALL_H + 4 + Math.random() * (H - WALL_H), x0 = Math.random() * W;
    x.beginPath(); x.moveTo(x0, y); x.quadraticCurveTo(x0 + 20, y + 1.5, x0 + 40 + Math.random() * 40, y); x.stroke();
  }
  x.fillStyle = rgba(theme.tableLit, 0.55); x.fillRect(0, WALL_H, W, 1.5);
  g = x.createRadialGradient(W / 2, H * 0.42, H * 0.22, W / 2, H * 0.42, H * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.62)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  return c;
}

function buildTarget() {
  const A = layer(), B = layer(), T = layer();
  const s = level.secret;
  A.x.fillStyle = theme.line; A.x.strokeStyle = theme.line; A.x.lineWidth = 1; A.x.lineJoin = 'round';
  shadowPolys(level.model, s.ry, s.rx, s.rz).forEach((p) => { pathOn(A.x, p.map(wallXY)); A.x.fill(); A.x.stroke(); });
  for (let k = 0; k < 12; k++) { const a = (k * Math.PI) / 6; B.x.drawImage(A.c, Math.cos(a) * 1.8, Math.sin(a) * 1.8, W, H); }
  B.x.globalCompositeOperation = 'destination-out'; B.x.drawImage(A.c, 0, 0, W, H);
  T.x.globalAlpha = 0.14; T.x.drawImage(A.c, 0, 0, W, H);
  T.x.globalAlpha = 0.95; T.x.drawImage(B.c, 0, 0, W, H);
  level.tcv = { el: T.c, fill: A.c };
}

function drawObject(faces, now) {
  const L = [-0.5, 0.45, -0.74];
  let minX = 1e9, maxX = -1e9, maxY = -1e9;
  const proj = faces.map((f) => f.map((p) => { const q = tableXY(p); minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); maxY = Math.max(maxY, q[1]); return q; }));
  const cx = (minX + maxX) / 2, rxE = Math.max(30, (maxX - minX) / 2);
  let g = ctx.createRadialGradient(cx + 10, maxY - 2, 2, cx + 10, maxY - 2, rxE * 1.1);
  g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.translate(cx + 10, maxY - 2); ctx.scale(1, 0.16); ctx.translate(-(cx + 10), -(maxY - 2));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx + 10, maxY - 2, rxE * 1.1, 0, 6.2832); ctx.fill(); ctx.restore();
  const order = faces.map((f, i) => [f.reduce((s, p) => s + p[2], 0) / f.length, i]).sort((a, b) => b[0] - a[0]);
  ctx.lineJoin = 'round'; ctx.lineWidth = 0.7;
  const fl = 0.04 * Math.sin(now * 0.02);
  order.forEach(([, i]) => {
    const f = faces[i];
    const ux = f[1][0] - f[0][0], uy = f[1][1] - f[0][1], uz = f[1][2] - f[0][2];
    const vx = f[2][0] - f[0][0], vy = f[2][1] - f[0][1], vz = f[2][2] - f[0][2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    const d = Math.min(1, Math.abs((nx * L[0] + ny * L[1] + nz * L[2]) / l) + fl);
    let col = mix(theme.shadow, theme.obj, 0.28 + 0.72 * d);
    if (d > 0.8) col = mix(theme.obj, '#fff4dc', (d - 0.8) * 1.6);
    pathOn(ctx, proj[i]);
    ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.stroke();
  });
}

function drawCandle(now) {
  const { x, y } = CANDLE;
  const fl = 1 + Math.sin(now * 0.021) * 0.07 + Math.sin(now * 0.057) * 0.05;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  let g = ctx.createRadialGradient(x, y - 60, 2, x, y - 60, 120 * fl);
  g.addColorStop(0, rgba(theme.glow, 0.42)); g.addColorStop(1, rgba(theme.glow, 0));
  ctx.fillStyle = g; ctx.fillRect(x - 140, y - 200, 280, 260); ctx.restore();
  g = ctx.createLinearGradient(x - 9, 0, x + 9, 0);
  g.addColorStop(0, '#bda887'); g.addColorStop(0.5, '#f7eedc'); g.addColorStop(1, '#a8916b');
  ctx.fillStyle = g; rr(ctx, x - 9, y - 46, 18, 46, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; rr(ctx, x - 9, y - 46, 18, 4, 2); ctx.fill();
  ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y - 46); ctx.lineTo(x, y - 51); ctx.stroke();
  const h = 19 * fl, sway = Math.sin(now * 0.013) * 1.6 + Math.sin(now * 0.041) * 0.6;
  ctx.beginPath(); ctx.moveTo(x, y - 48);
  ctx.quadraticCurveTo(x - 6.5, y - 48 - h * 0.42, x + sway, y - 48 - h);
  ctx.quadraticCurveTo(x + 6.5, y - 48 - h * 0.42, x, y - 48);
  g = ctx.createRadialGradient(x, y - 53, 1, x, y - 55, h);
  g.addColorStop(0, '#fffdf0'); g.addColorStop(0.35, '#ffd36b'); g.addColorStop(1, 'rgba(255,110,30,0.25)');
  ctx.fillStyle = g; ctx.fill();
}

function step(dt) {
  dust.forEach((p) => {
    p.x += p.vx * dt; p.y += p.vy * dt; p.ph += dt * 0.002;
    if (p.y < 20) { p.y = 510; p.x = 20 + Math.random() * 320; }
    if (p.x < 5 || p.x > 355) p.vx = -p.vx;
  });
  sparks = sparks.filter((s) => (s.life -= dt) > 0);
  sparks.forEach((s) => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 0.0004 * dt; });
}

function draw(now) {
  if (!level) return;
  now = now || performance.now();
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  if (!bgCache) bgCache = buildBg();
  ctx.drawImage(bgCache, 0, 0, W, H);
  if (!level.tcv) buildTarget();

  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, WALL_H - 9); ctx.clip();
  ctx.drawImage(level.tcv.el, 0, 0, W, H);
  const S = shadowLayer || (shadowLayer = layer());
  S.x.clearRect(0, 0, W, H);
  S.x.fillStyle = theme.shadow;
  const fdx = Math.sin(now * 0.011) * 0.6 + Math.sin(now * 0.037) * 0.35, fs = 1 + Math.sin(now * 0.017) * 0.004;
  S.x.save(); S.x.translate(SX + fdx, SY); S.x.scale(fs, fs); S.x.translate(-SX, -SY);
  shadowPolys(level.model, ry, rx, rz).forEach((p) => { pathOn(S.x, p.map(wallXY)); S.x.fill(); });
  S.x.restore();
  ctx.save();
  if (CAN_FILTER) ctx.filter = 'blur(' + (1.5 * scale * dpr).toFixed(1) + 'px)';
  ctx.globalAlpha = 0.86; ctx.drawImage(S.c, 0, 0, W, H);
  ctx.restore();
  if (winAt) {
    const p = Math.min(1, (now - winAt) / 1100);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85 * Math.sin(p * Math.PI);
    ctx.drawImage(level.tcv.fill, 0, 0, W, H);
    ctx.restore();
  }
  ctx.restore();

  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(CANDLE.x, CANDLE.y - 60, SX, SY);
  g.addColorStop(0, rgba(theme.glow, 0.09)); g.addColorStop(1, rgba(theme.glow, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(CANDLE.x, CANDLE.y - 60); ctx.lineTo(SX - 160, 40); ctx.lineTo(SX + 175, 60); ctx.lineTo(SX + 175, 330); ctx.closePath(); ctx.fill();
  dust.forEach((p) => {
    ctx.globalAlpha = 0.25 + 0.25 * Math.sin(p.ph * 3);
    ctx.fillStyle = theme.glow; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
  });
  ctx.restore();

  if (ghost) {
    ctx.save(); ctx.setLineDash([4, 5]); ctx.lineWidth = 1.4; ctx.strokeStyle = theme.line; ctx.globalAlpha = 0.85;
    rotateFaces(level.model, level.secret.ry, level.secret.rx, level.secret.rz).forEach((f) => { pathOn(ctx, f.map(tableXY)); ctx.stroke(); });
    ctx.restore();
  }
  drawObject(rotateFaces(level.model, ry, rx, rz), now);
  drawCandle(now);

  if (sparks.length) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    sparks.forEach((s) => { ctx.globalAlpha = Math.min(1, s.life / 400); ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill(); });
    ctx.restore();
  }
}

let lastFrame = 0;
function loop(t) {
  requestAnimationFrame(loop);
  if (!level || !$('screen-game').classList.contains('active') || document.hidden) { lastFrame = t; return; }
  if (t - lastFrame < 30) return;
  step(Math.min(60, t - lastFrame)); lastFrame = t; draw(t);
}
requestAnimationFrame(loop);

function clamp() { ry = Math.max(-120, Math.min(120, ry)); rx = Math.max(-100, Math.min(100, rx)); }
function changed() { clamp(); recompute(); draw(); }

let drag = null;
cv.addEventListener('pointerdown', (e) => { if (locked) return; drag = { x: e.clientX, y: e.clientY, t: performance.now() }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', (e) => {
  if (!drag || locked) return;
  const k = 0.55 / scale;
  ry += (e.clientX - drag.x) * k; rx += (e.clientY - drag.y) * k;
  const nt = performance.now(), dist = Math.hypot(e.clientX - drag.x, e.clientY - drag.y) / scale;
  Sound.drag(dist / Math.max(8, nt - drag.t));
  drag.x = e.clientX; drag.y = e.clientY; drag.t = nt; moves++; changed();
});
function release() { if (!drag) return; drag = null; Sound.dragEnd(); check(); }
cv.addEventListener('pointerup', release);
cv.addEventListener('pointercancel', release);

function nudge(dy, dx) { if (locked) return; ry += dy; rx += dx; moves++; Sound.click(); changed(); check(); }
$('btn-left').onclick = () => nudge(-1.5, 0);
$('btn-right').onclick = () => nudge(1.5, 0);
$('btn-up').onclick = () => nudge(0, -1.5);
$('btn-down').onclick = () => nudge(0, 1.5);
let lastTick = 0;
$('roll').addEventListener('input', (e) => {
  if (locked) return;
  rz = +e.target.value; moves++;
  if (Math.abs(rz - lastTick) >= 5) { lastTick = Math.round(rz / 5) * 5; Sound.tick(); }
  changed();
});
$('roll').addEventListener('change', () => check());

function check() {
  if (locked || match < level.thr) return;
  locked = true;
  ry = level.secret.ry; rx = level.secret.rx; rz = level.secret.rz; $('roll').value = rz; recompute();
  winAt = performance.now();
  for (let k = 0; k < 60; k++) {
    const a = Math.random() * 6.2832, v = 0.05 + Math.random() * 0.18;
    sparks.push({ x: SX + (Math.random() - 0.5) * 80, y: SY + (Math.random() - 0.5) * 80, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.08, r: 1 + Math.random() * 2, life: 700 + Math.random() * 700, c: Math.random() < 0.5 ? theme.line : theme.glow });
  }
  buzz([20, 40, 30]);
  const secs = (Date.now() - t0) / 1000;
  if (level.daily) winDaily(secs); else winLevel(secs);
  persist(); finished++;
  Sound.win();
  Platform.gameplay(false);
  Analytics.progress(maxReached(), save.daily.streak);
  const lvl = level;
  winTimer = setTimeout(async () => {
    if (finished % 3 === 0 && await withAd(() => Platform.showInterstitial())) Analytics.event('ad_interstitial');
    if (level === lvl && locked) $('win').classList.remove('hidden');
  }, 1100);
}

function winLevel(secs) {
  const fast = level.index < 20 ? 45 : level.index < 40 ? 75 : 100;
  const stars = hintUsed ? 1 : secs < fast ? 3 : 2;
  const i = level.index;
  save.stars[i] = Math.max(save.stars[i] || 0, stars);
  $('win-title').textContent = t('matched');
  $('win-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('win-info').textContent = t('time', { s: Math.round(secs) });
  $('win-next').textContent = i + 1 < LEVEL_COUNT ? t('next') : t('toLevels');
  setStatus(t('matched'));
  Analytics.event('level_win', { level: i + 1, sec: Math.round(secs), hint: hintUsed, stars });
}

function winDaily(secs) {
  const d = save.daily, today = todayKey(), first = d.last !== today;
  if (first) {
    d.streak = d.last === yesterdayKey() ? d.streak + 1 : 1;
    d.best = Math.max(d.best || 0, d.streak);
    d.last = today;
    save.freeHints = Math.min(5, (save.freeHints || 0) + 1);
  }
  $('win-title').textContent = t('dailyDone');
  $('win-stars').textContent = t('streak', { n: d.streak });
  $('win-info').textContent = (first ? t('dailyReward') : t('dailyAgain')) + ' · ' + t('time', { s: Math.round(secs) });
  $('win-next').textContent = t('toMenu');
  setStatus(t('dailyDone'));
  if (first) Analytics.event('daily_win', { day: level.dayIdx, streak: d.streak, sec: Math.round(secs), hint: hintUsed });
}

async function withAd(fn) {
  const wasPlaying = $('screen-game').classList.contains('active') && !locked;
  Platform.gameplay(false); Sound.pauseAll();
  let r = false;
  try { r = await fn(); } catch (e) { r = false; }
  Sound.resumeAll();
  if (wasPlaying && !locked) Platform.gameplay(true);
  return r;
}

$('win-next').onclick = () => {
  if (level.daily) { goMenu(); return; }
  const i = level.index;
  if (i + 1 < LEVEL_COUNT) startLevel(i + 1); else openLevels();
};
$('win-retry').onclick = () => (level.daily ? startDaily() : startLevel(level.index));

$('btn-hint').onclick = async () => {
  if (locked || ghost) return;
  const free = save.freeHints > 0;
  if (free) { save.freeHints--; persist(); hintLabel(); }
  else {
    const ok = await withAd(() => Platform.showRewarded());
    if (!ok) { setStatus(t('noReward')); return; }
    Analytics.event('ad_rewarded');
  }
  Analytics.event('hint', { level: level.daily ? 'daily' : level.index + 1, free });
  hintUsed = true; ghost = true; Sound.hint();
  setStatus(t('hintOn'));
  draw();
};

function openLevels() {
  const grid = $('level-grid');
  grid.innerHTML = '';
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const open = UNLOCK_ALL || i === 0 || save.stars[i - 1] > 0;
    const b = document.createElement('button');
    b.className = 'cell' + (open ? '' : ' locked');
    const s = save.stars[i] || 0;
    b.innerHTML = (i + 1) + '<small>' + (open ? '★'.repeat(s) + '☆'.repeat(3 - s) : '—') + '</small>';
    if (open) b.onclick = () => startLevel(i);
    grid.appendChild(b);
  }
  applyTheme(THEMES[0]); show('screen-levels');
}
function firstOpen() { for (let i = 0; i < LEVEL_COUNT; i++) if (!(save.stars[i] > 0)) return i; return LEVEL_COUNT - 1; }

$('btn-play').onclick = () => startLevel(firstOpen());
$('btn-levels').onclick = openLevels;
$('btn-daily').onclick = startDaily;
function renderDaily() {
  const d = save.daily, done = d.last === todayKey(), alive = d.last === yesterdayKey() && d.streak > 0;
  $('daily-sub').textContent = done ? t('dailyDoneSub', { n: d.streak }) : alive ? t('dailyKeep', { n: d.streak }) : t('dailyNew');
  $('btn-daily').classList.toggle('fresh', !done);
}
function goMenu() { applyTheme(THEMES[0]); renderDaily(); show('screen-menu'); }
$('levels-back').onclick = goMenu;
$('game-back').onclick = () => {
  if (level && !locked) Analytics.event(level.daily ? 'daily_quit' : 'level_quit', { level: level.daily ? 'daily' : level.index + 1, sec: Math.round((Date.now() - t0) / 1000) });
  goMenu();
};
function soundLabel() { $('btn-sound').textContent = t('sound') + ': ' + t(save.sound ? 'on' : 'off'); }
function musicLabel() { $('btn-music').textContent = t('music') + ': ' + t(save.music ? 'on' : 'off'); }
$('btn-sound').onclick = () => { save.sound = !save.sound; persist(); soundLabel(); Sound.setSfx(save.sound); };
$('btn-music').onclick = () => { save.music = !save.music; persist(); musicLabel(); Sound.setMusic(save.music); };
document.addEventListener('pointerdown', () => Sound.unlock(), true);
document.addEventListener('click', (e) => { const b = e.target.closest('.btn, .cell, .icon'); if (b && !b.closest('.controls')) Sound.ui(); }, true);
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { Sound.pauseAll(); Platform.gameplay(false); return; }
  Sound.resumeAll();
  if ($('screen-game').classList.contains('active') && !locked) Platform.gameplay(true);
});
document.addEventListener('keydown', (e) => {
  if (!$('screen-game').classList.contains('active') || locked) return;
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a') nudge(-1.5, 0);
  else if (k === 'ArrowRight' || k === 'd') nudge(1.5, 0);
  else if (k === 'ArrowUp' || k === 'w') nudge(0, -1.5);
  else if (k === 'ArrowDown' || k === 's') nudge(0, 1.5);
  else if ((k === 'q' || k === 'e') && level.hasRoll) { rz = Math.max(-90, Math.min(90, rz + (k === 'q' ? -1.5 : 1.5))); $('roll').value = rz; Sound.tick(); changed(); check(); }
  else return;
  e.preventDefault();
});
applyTheme(THEMES[0]);

async function boot() {
  const lang = await Platform.init();
  setLang(lang);
  applyStatic();
  save = await Platform.loadSave(makeDefaults());
  if (!save.daily || typeof save.daily !== 'object') save.daily = makeDefaults().daily;
  if (typeof save.freeHints !== 'number') save.freeHints = 0;
  Sound.setSfx(save.sound); Sound.setMusic(save.music);
  soundLabel(); musicLabel(); renderDaily();
  Analytics.init(Platform.name);
  if (/[?&]stats=1/.test(location.search)) {
    const el = document.createElement('pre'); el.className = 'stats';
    el.textContent = JSON.stringify(Analytics.localStats(), null, 1);
    document.body.appendChild(el);
  }
  Platform.ready();
  // CrazyGames: a new player lands straight in level 1 instead of the menu.
  if (Platform.directStart && !save.stars.some((x) => x > 0)) startLevel(0);
}
boot();

window.__sh = { Sound, Platform, Analytics, startLevel, startDaily, get save() { return save; }, set(a, b, c) { ry = a; rx = b; rz = c || 0; changed(); check(); }, get state() { return { ry, rx, rz, match, locked, level }; } };
