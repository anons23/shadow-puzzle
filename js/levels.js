import { buildModel, TEMPLATES, mulberry32, rasterize, shadowPolys, iou, matchAt, areaFraction } from './engine.js';

export const LEVEL_COUNT = 20;

export const THEMES = [
  { name: 'Бумага', bg: '#f4efe3', fg: '#2b2a26', soft: '#e3dccb', wallbg: '#fbf8ef', shadow: '#2b2a26', line: '#d9482b', obj: '#1f6f8b' },
  { name: 'Ночь', bg: '#12141f', fg: '#e8ecff', soft: '#1d2133', wallbg: '#262c47', shadow: '#05060c', line: '#5eead4', obj: '#fbbf24' },
  { name: 'Неон', bg: '#0b0b10', fg: '#f5f5ff', soft: '#171722', wallbg: '#231a33', shadow: '#000000', line: '#ff2d95', obj: '#00e5ff' },
  { name: 'Лёд', bg: '#e8f3fb', fg: '#14304a', soft: '#d3e6f3', wallbg: '#f6fbff', shadow: '#1b3a57', line: '#1d4ed8', obj: '#0ea5a4' },
];

const PLAN = [
  ['angle'], ['tee'], ['stairs'], ['tree'], ['house'], ['chair'], ['mushroom'], ['arch'], ['table'], ['rocket'],
  ['lamp'], ['cross'], ['frame'],
  ['chair', 'tree'], ['house', 'lamp'], ['table', 'mushroom'], ['rocket', 'arch'], ['stairs', 'tree'], ['cross', 'house'], ['frame', 'rocket'],
];

function params(i) {
  if (i < 5) return { ry: [40, 75], rx: [8, 25], thr: 0.88, width: 6 };
  if (i < 13) return { ry: [35, 80], rx: [15, 45], thr: 0.86, width: 5 };
  return { ry: [30, 85], rx: [20, 55], thr: 0.84, width: 5 };
}

function width(model, grid, sec, thr) {
  let best = 90;
  for (let k = 0; k < 8; k++) {
    const ang = (k * Math.PI) / 4, dy = Math.cos(ang), dx = Math.sin(ang);
    let r = 0;
    while (r < 40 && matchAt(model, grid, sec.ry + dy * (r + 1), sec.rx + dx * (r + 1)) >= thr) r++;
    best = Math.min(best, r);
  }
  return best;
}

const cache = new Map();

export function getLevel(index) {
  if (cache.has(index)) return cache.get(index);
  const keys = PLAN[index], p = Object.assign({}, params(index)), model = buildModel(keys);
  if (keys.length === 1 && TEMPLATES[keys[0]].sym) p.rx = [30, 58];
  const name = keys.map((k) => TEMPLATES[k].name).join(' + ');
  let best = null;
  for (let attempt = 0; attempt < 300; attempt++) {
    const rng = mulberry32(index * 7919 + attempt * 31 + 5);
    const sign = () => (rng() < 0.5 ? -1 : 1);
    const sec = { ry: sign() * (p.ry[0] + rng() * (p.ry[1] - p.ry[0])), rx: sign() * (p.rx[0] + rng() * (p.rx[1] - p.rx[0])) };
    const grid = rasterize(shadowPolys(model, sec.ry, sec.rx));
    const area = areaFraction(grid);
    const relaxed = attempt >= 150;
    if (area < (relaxed ? 0.03 : 0.05)) continue;
    const startIou = matchAt(model, grid, 0, 0);
    if (startIou > (relaxed ? 0.8 : 0.6)) continue;
    const w = width(model, grid, sec, p.thr);
    const need = attempt < 150 ? p.width : attempt < 250 ? p.width * 0.6 : 2;
    const cand = { index, name, model, secret: sec, thr: p.thr, grid, width: w, startIou, area, theme: Math.floor(index / 5) % THEMES.length };
    if (!best || w > best.width) best = cand;
    if (w >= need) { best = cand; break; }
  }
  cache.set(index, best);
  return best;
}
