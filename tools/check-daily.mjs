import { getDaily } from '../js/levels.js';
import { DAILY } from '../js/daily-data.js';
import { matchAt, mulberry32 } from '../js/engine.js';
let bad = 0, lucky = 0;
const rng = mulberry32(7);
for (let i = 0; i < DAILY.length; i++) {
  const L = getDaily(i), s = L.secret;
  const self = matchAt(L.model, L.grid, s.ry, s.rx, s.rz);
  const start = matchAt(L.model, L.grid, 0, 0, 0);
  let near = 1;
  for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; near = Math.min(near, matchAt(L.model, L.grid, s.ry + Math.cos(a) * 2, s.rx + Math.sin(a) * 2, s.rz)); }
  for (let n = 0; n < 60; n++) if (matchAt(L.model, L.grid, -120 + rng() * 240, -100 + rng() * 200, -90 + rng() * 180) >= L.thr) lucky++;
  if (!(self > 0.99 && start < L.thr && near >= L.thr)) { bad++; console.log('FAIL day', i, L.keys.join('+'), self.toFixed(2), start.toFixed(2), near.toFixed(2), L.thr); }
}
console.log(bad ? 'FAIL ' + bad : 'ALL ' + DAILY.length + ' OK', '| random-pose wins:', lucky, 'of', DAILY.length * 60);
