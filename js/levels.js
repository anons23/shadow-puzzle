import { buildModel, TEMPLATES, rasterize, shadowPolys } from './engine.js';
import { LEVELS } from './levels-data.js';

export const LEVEL_COUNT = LEVELS.length;
export const METER_LEVELS = 7;
export const ROLL_FROM = 14;

export const THEMES = [
  { name: 'Чердак', bg: '#17110c', fg: '#f3e6d0', soft: '#2a1f16', line: '#ffc46b', obj: '#c98a4b', wall: '#4a3a2c', wallLit: '#d9b98c', table: '#3e2816', tableLit: '#8a5e38', shadow: '#120a05', glow: '#ffb347' },
  { name: 'Детская', bg: '#0f1424', fg: '#e6ecff', soft: '#1b2238', line: '#8fd3ff', obj: '#e7a5c4', wall: '#26304d', wallLit: '#8ea6d8', table: '#2a2440', tableLit: '#5d527d', shadow: '#05070f', glow: '#ffd59a' },
  { name: 'Театр', bg: '#160809', fg: '#ffe9e0', soft: '#2a1214', line: '#ffd36b', obj: '#d9d2c5', wall: '#5a1418', wallLit: '#e0866e', table: '#24150f', tableLit: '#5a3a28', shadow: '#0a0203', glow: '#ff9a5a' },
  { name: 'Мастерская', bg: '#121513', fg: '#e9f0e6', soft: '#1f2621', line: '#b6f08f', obj: '#b8c2c9', wall: '#3c4640', wallLit: '#c6d1b8', table: '#33281c', tableLit: '#7a6045', shadow: '#070908', glow: '#ffe2a0' },
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
    theme: Math.floor(index / 15) % THEMES.length,
    hasRoll: index >= ROLL_FROM,
    meter: index < METER_LEVELS,
  };
  cache.set(index, L);
  return L;
}
