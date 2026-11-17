import { buildModel, rotateFaces, shadowPolys, mulberry32 } from '../../js/engine.js';
import { THEMES } from '../../js/levels.js';

function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; }
function rgba(c, a) { return 'rgba(' + hex(c).join(',') + ',' + a + ')'; }
function path(c, pts) { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); }
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function off(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

export function drawScene(ctx, W, H, o) {
  const th = o.theme, rnd = mulberry32(o.seed || 7);
  const wallXY = (p) => [o.wall.x + p[0] * o.wall.s, o.wall.y - p[1] * o.wall.s];
  const objXY = (p) => [o.obj.x + (p[0] + 0.35 * p[2]) * o.obj.s, o.obj.y - (p[1] + 0.25 * p[2]) * o.obj.s];
  const TY = o.tableY;

  ctx.fillStyle = th.wall; ctx.fillRect(0, 0, W, TY);
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  const stripe = Math.max(12, W / 32);
  for (let i = 0; i < W; i += stripe * 2) ctx.fillRect(i, 0, stripe, TY);
  let g = ctx.createRadialGradient(o.wall.x, o.wall.y, 10, o.wall.x, o.wall.y, o.lightR);
  g.addColorStop(0, rgba(th.wallLit, 0.95)); g.addColorStop(0.5, rgba(th.wallLit, 0.32)); g.addColorStop(1, rgba(th.wallLit, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, TY);
  const bb = Math.max(6, H * 0.018);
  ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fillRect(0, TY - bb, W, bb);
  ctx.fillStyle = rgba(th.wallLit, 0.25); ctx.fillRect(0, TY - bb - 1, W, 1.5);
  g = ctx.createLinearGradient(0, TY, 0, H); g.addColorStop(0, th.table); g.addColorStop(1, th.tableLit);
  ctx.fillStyle = g; ctx.fillRect(0, TY, W, H - TY);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
  const step = W / 14;
  for (let k = -12; k <= 12; k++) { ctx.beginPath(); ctx.moveTo(o.wall.x + k * step * 0.36, TY); ctx.lineTo(o.wall.x + k * step, H); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  for (let i = 0; i < W / 4; i++) { const y = TY + 4 + rnd() * (H - TY), x0 = rnd() * W; ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo(x0 + 20, y + 1.5, x0 + 40 + rnd() * 50, y); ctx.stroke(); }

  const target = shadowPolys(o.model, o.target.ry, o.target.rx, o.target.rz);
  const [A, a] = off(W, H);
  a.fillStyle = th.line; a.strokeStyle = th.line; a.lineJoin = 'round';
  target.forEach((p) => { path(a, p.map(wallXY)); a.fill(); a.stroke(); });
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, TY - bb); ctx.clip();
  if (o.outline) {
    const [B, b] = off(W, H), ow = Math.max(1.8, o.wall.s * 0.04);
    for (let k = 0; k < 16; k++) { const an = (k * Math.PI) / 8; b.drawImage(A, Math.cos(an) * ow, Math.sin(an) * ow); }
    b.globalCompositeOperation = 'destination-out'; b.drawImage(A, 0, 0);
    ctx.globalAlpha = 0.15; ctx.drawImage(A, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(B, 0, 0);
  }
  const [S, s] = off(W, H);
  s.fillStyle = th.shadow;
  shadowPolys(o.model, o.rot.ry, o.rot.rx, o.rot.rz).forEach((p) => { path(s, p.map(wallXY)); s.fill(); });
  ctx.filter = 'blur(' + Math.max(1.5, o.wall.s * 0.035) + 'px)'; ctx.globalAlpha = 0.88; ctx.drawImage(S, 0, 0);
  ctx.filter = 'none'; ctx.globalAlpha = 1;
  if (o.glow) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(' + o.wall.s * 0.25 + 'px)'; ctx.globalAlpha = o.glow * 0.7; ctx.drawImage(A, 0, 0);
    ctx.filter = 'none'; ctx.globalAlpha = o.glow * 0.8; ctx.drawImage(A, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();

  g = ctx.createRadialGradient(W * (o.vx || 0.5), H * 0.45, Math.min(W, H) * 0.25, W * (o.vx || 0.5), H * 0.45, Math.max(W, H) * 0.8);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + (o.vignette || 0.62) + ')');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const C = o.candle, k = C.k, fx = C.x, fy = C.y - 48 * k;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  g = ctx.createLinearGradient(fx, fy, o.wall.x, o.wall.y);
  g.addColorStop(0, rgba(th.glow, 0.1)); g.addColorStop(1, rgba(th.glow, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(o.wall.x - o.lightR * 0.8, 0); ctx.lineTo(o.wall.x + o.lightR * 0.9, 0); ctx.lineTo(o.wall.x + o.lightR * 0.9, TY); ctx.closePath(); ctx.fill();
  for (let i = 0; i < (o.dust || 30); i++) {
    const x = rnd() * W, y = rnd() * H * 0.95;
    ctx.globalAlpha = 0.2 + rnd() * 0.4; ctx.fillStyle = th.glow;
    ctx.beginPath(); ctx.arc(x, y, (0.7 + rnd() * 1.4) * Math.max(1, k * 0.8), 0, 6.2832); ctx.fill();
  }
  ctx.restore();

  if (o.showObject !== false) {
    const faces = rotateFaces(o.model, o.rot.ry, o.rot.rx, o.rot.rz);
    let minX = 1e9, maxX = -1e9, maxY = -1e9;
    const proj = faces.map((f) => f.map((p) => { const q = objXY(p); minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); maxY = Math.max(maxY, q[1]); return q; }));
    const cx = (minX + maxX) / 2 + o.obj.s * 0.2, rxE = (maxX - minX) / 2 * 1.1;
    ctx.save(); ctx.translate(cx, maxY - 2); ctx.scale(1, 0.16);
    g = ctx.createRadialGradient(0, 0, 2, 0, 0, rxE); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rxE, 0, 6.2832); ctx.fill(); ctx.restore();
    const L = [-0.5, 0.45, -0.74];
    faces.map((f, i) => [f.reduce((sm, p) => sm + p[2], 0) / f.length, i]).sort((x, y) => y[0] - x[0]).forEach(([, i]) => {
      const f = faces[i];
      const ux = f[1][0] - f[0][0], uy = f[1][1] - f[0][1], uz = f[1][2] - f[0][2];
      const vx = f[2][0] - f[0][0], vy = f[2][1] - f[0][1], vz = f[2][2] - f[0][2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
      const d = Math.min(1, Math.abs((nx * L[0] + ny * L[1] + nz * L[2]) / l));
      let col = mix(th.shadow, th.obj, 0.28 + 0.72 * d);
      if (d > 0.8) col = mix(th.obj, '#fff4dc', (d - 0.8) * 1.6);
      path(ctx, proj[i]); ctx.fillStyle = col; ctx.fill();
      ctx.lineWidth = Math.max(0.7, o.obj.s * 0.016); ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.stroke();
    });
  }

  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  g = ctx.createRadialGradient(fx, fy - 10 * k, 2, fx, fy - 10 * k, 120 * k);
  g.addColorStop(0, rgba(th.glow, 0.45)); g.addColorStop(1, rgba(th.glow, 0));
  ctx.fillStyle = g; ctx.fillRect(fx - 140 * k, fy - 150 * k, 280 * k, 280 * k); ctx.restore();
  g = ctx.createLinearGradient(fx - 9 * k, 0, fx + 9 * k, 0);
  g.addColorStop(0, '#bda887'); g.addColorStop(0.5, '#f7eedc'); g.addColorStop(1, '#a8916b');
  ctx.fillStyle = g; rr(ctx, fx - 9 * k, C.y - 46 * k, 18 * k, 46 * k, 3 * k); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; rr(ctx, fx - 9 * k, C.y - 46 * k, 18 * k, 4 * k, 2 * k); ctx.fill();
  ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1.4 * k; ctx.beginPath(); ctx.moveTo(fx, C.y - 46 * k); ctx.lineTo(fx, C.y - 51 * k); ctx.stroke();
  const h = 20 * k, y0 = C.y - 48 * k;
  ctx.beginPath(); ctx.moveTo(fx, y0);
  ctx.quadraticCurveTo(fx - 6.5 * k, y0 - h * 0.42, fx + 1 * k, y0 - h);
  ctx.quadraticCurveTo(fx + 6.5 * k, y0 - h * 0.42, fx, y0);
  g = ctx.createRadialGradient(fx, y0 - 5 * k, 1, fx, y0 - 7 * k, h);
  g.addColorStop(0, '#fffdf0'); g.addColorStop(0.35, '#ffd36b'); g.addColorStop(1, 'rgba(255,110,30,0.25)');
  ctx.fillStyle = g; ctx.fill();
}

export function drawTitle(ctx, o) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = o.size * 0.25; ctx.shadowOffsetY = o.size * 0.04;
  ctx.font = '700 ' + o.size + 'px "DejaVu Serif", serif';
  const g = ctx.createLinearGradient(0, o.y - o.size, 0, o.y);
  g.addColorStop(0, '#fff3d6'); g.addColorStop(1, '#ffc46b');
  ctx.fillStyle = g; ctx.fillText(o.title, o.x, o.y);
  ctx.shadowBlur = o.size * 0.12;
  ctx.font = '500 ' + Math.round(o.size * 0.24) + 'px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,240,215,0.92)';
  ctx.fillText(o.tag, o.x + o.size * 0.04, o.y + o.size * 0.48);
  ctx.restore();
}

export const PRESETS = { THEMES, buildModel };
