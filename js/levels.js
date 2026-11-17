import { buildModel, TEMPLATES, rasterize, shadowPolys } from './engine.js';
import { LEVELS } from './levels-data.js';

export const LEVEL_COUNT = LEVELS.length;
export const METER_LEVELS = 7;
export const ROLL_FROM = 14;

export const THEMES = [
  { name: 'Бумага', bg: '#f4efe3', fg: '#2b2a26', soft: '#e3dccb', wallbg: '#fbf8ef', shadow: '#2b2a26', line: '#d9482b', obj: '#1f6f8b' },
  { name: 'Ночь', bg: '#12141f', fg: '#e8ecff', soft: '#1d2133', wallbg: '#262c47', shadow: '#05060c', line: '#5eead4', obj: '#fbbf24' },
  { name: 'Неон', bg: '#0b0b10', fg: '#f5f5ff', soft: '#171722', wallbg: '#231a33', shadow: '#000000', line: '#ff2d95', obj: '#00e5ff' },
  { name: 'Лёд', bg: '#e8f3fb', fg: '#14304a', soft: '#d3e6f3', wallbg: '#f6fbff', shadow: '#1b3a57', line: '#1d4ed8', obj: '#0ea5a4' },
];

const cache = new Map();

export function getLevel(index) {
  if (cache.has(index)) return cache.get(index);
  const d = LEVELS[index], model = buildModel(d.keys);
  const secret = { ry: d.ry, rx: d.rx, rz: d.rz };
  const grid = rasterize(shadowPolys(model, secret.ry, secret.rx, secret.rz));
  const L = {
    index, model, secret, grid, thr: d.thr,
    name: d.keys.map((k) => TEMPLATES[k].name).join(' + '),
    theme: Math.floor(index / 5) % THEMES.length,
    hasRoll: index >= ROLL_FROM,
    meter: index < METER_LEVELS,
  };
  cache.set(index, L);
  return L;
}
