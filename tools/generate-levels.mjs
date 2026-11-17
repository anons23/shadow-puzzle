import { writeFileSync } from 'node:fs';
import { buildModel, TEMPLATES, mulberry32, rasterize, shadowPolys, matchAt, areaFraction } from '../js/engine.js';

const SINGLES = ['angle', 'tee', 'stairs', 'tree', 'house', 'chair', 'mushroom', 'arch', 'table', 'rocket', 'lamp', 'cross', 'frame', 'ladder', 'windmill', 'bench', 'castle', 'cactus', 'letterE'];
const COUNT = 60, ROLL_FROM = 14;

function plan() {
  const out = SINGLES.map((k) => [k]);
  const seen = new Set();
  const rng = mulberry32(2024);
  const pick = (n) => {
    for (;;) {
      const set = new Set();
      while (set.size < n) set.add(SINGLES[Math.floor(rng() * SINGLES.length)]);
      const keys = [...set], id = [...keys].sort().join('|');
      if (!seen.has(id)) { seen.add(id); return keys; }
    }
  };
  for (let j = 0; j < 20; j++) out.push(pick(2));
  while (out.length < COUNT) out.push(pick(3));
  return out;
}

function windowDeg(i) { return i < 5 ? 6 : i < 20 ? 5 : i < 40 ? 4 : 3.5; }

function dirs(withRoll) {
  const out = [];
  for (let k = 0; k < 8; k++) out.push([Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4), 0]);
  if (withRoll) out.push([0, 0, 1], [0, 0, -1]);
  return out;
}

function calibrate(model, grid, s, w) {
  let t = 1;
  for (const d of dirs(!!s.rz)) t = Math.min(t, matchAt(model, grid, s.ry + d[0] * w, s.rx + d[1] * w, s.rz + d[2] * w));
  return t;
}

const levels = [];
plan().forEach((keys, i) => {
  const model = buildModel(keys), sym = keys.length === 1 && TEMPLATES[keys[0]].sym;
  const rxR = sym ? [30, 58] : i < 13 ? [15, 45] : [20, 58];
  const w = windowDeg(i);
  let best = null;
  for (let attempt = 0; attempt < 500; attempt++) {
    const rng = mulberry32(i * 7919 + attempt * 31 + 5);
    const sg = () => (rng() < 0.5 ? -1 : 1);
    const s = {
      ry: sg() * (35 + rng() * 50),
      rx: sg() * (rxR[0] + rng() * (rxR[1] - rxR[0])),
      rz: i >= ROLL_FROM ? sg() * (15 + rng() * 35) : 0,
    };
    const grid = rasterize(shadowPolys(model, s.ry, s.rx, s.rz));
    if (areaFraction(grid) < 0.04) continue;
    const t = Math.min(0.95, calibrate(model, grid, s, w));
    const startIou = matchAt(model, grid, 0, 0, 0);
    const margin = t - startIou;
    const cand = { keys, ry: +s.ry.toFixed(2), rx: +s.rx.toFixed(2), rz: +s.rz.toFixed(2), thr: +(t - 0.005).toFixed(3), window: w, startIou: +startIou.toFixed(2) };
    const score = Math.min(t - 0.72, margin - 0.25);
    if (!best || score > best.score) best = Object.assign(cand, { score });
    if (t >= 0.8 && margin >= 0.3) { best = cand; break; }
  }
  delete best.score;
  levels.push(best);
  console.log(`#${i + 1} ${keys.map((k) => TEMPLATES[k].name).join(' + ')} thr=${best.thr} window=${best.window} start=${best.startIou}`);
});
writeFileSync(new URL('../js/levels-data.js', import.meta.url), 'export const LEVELS = ' + JSON.stringify(levels) + ';\n');
console.log('written', levels.length);
