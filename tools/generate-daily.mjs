import { writeFileSync } from 'node:fs';
import { buildModel, mulberry32, rasterize, shadowPolys, matchAt, areaFraction } from '../js/engine.js';

// 365 daily levels: medium difficulty, tilt always on, 1-3 objects depending on the day.
const SINGLES = ['angle', 'tee', 'stairs', 'tree', 'house', 'chair', 'mushroom', 'arch', 'table', 'rocket', 'lamp', 'cross', 'frame', 'ladder', 'windmill', 'bench', 'castle', 'cactus', 'letterE'];
const DAYS = 365, WINDOW = 4.5, PARTS = [1, 2, 2, 2, 3, 2, 1];

function dirs() {
  const out = [];
  for (let k = 0; k < 8; k++) out.push([Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4), 0]);
  out.push([0, 0, 1], [0, 0, -1]);
  return out;
}
function calibrate(model, grid, s) {
  let t = 1;
  for (const d of dirs()) t = Math.min(t, matchAt(model, grid, s.ry + d[0] * WINDOW, s.rx + d[1] * WINDOW, s.rz + d[2] * WINDOW));
  return t;
}

const out = [];
const t0 = Date.now();
for (let day = 0; day < DAYS; day++) {
  const rng = mulberry32(90001 + day * 131);
  const set = new Set();
  while (set.size < PARTS[day % 7]) set.add(SINGLES[Math.floor(rng() * SINGLES.length)]);
  const keys = [...set], model = buildModel(keys);
  let best = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const r = mulberry32(day * 7907 + attempt * 37 + 3);
    const sg = () => (r() < 0.5 ? -1 : 1);
    const s = { ry: sg() * (35 + r() * 50), rx: sg() * (20 + r() * 38), rz: sg() * (15 + r() * 35) };
    const grid = rasterize(shadowPolys(model, s.ry, s.rx, s.rz));
    if (areaFraction(grid) < 0.04) continue;
    const t = Math.min(0.95, calibrate(model, grid, s));
    const margin = t - matchAt(model, grid, 0, 0, 0);
    const cand = { keys, ry: +s.ry.toFixed(2), rx: +s.rx.toFixed(2), rz: +s.rz.toFixed(2), thr: +(t - 0.005).toFixed(3) };
    const score = Math.min(t - 0.72, margin - 0.25);
    if (!best || score > best.score) best = Object.assign(cand, { score });
    if (t >= 0.8 && margin >= 0.3) { best = cand; break; }
  }
  delete best.score;
  out.push(best);
  if (day % 50 === 0) console.log('day', day, keys.join('+'), 'thr', best.thr, Math.round((Date.now() - t0) / 1000) + 's');
}
writeFileSync(new URL('../js/daily-data.js', import.meta.url), 'export const DAILY = ' + JSON.stringify(out) + ';\n');
console.log('written', out.length, 'min thr', Math.min(...out.map((d) => d.thr)));
