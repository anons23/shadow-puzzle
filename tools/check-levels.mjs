import { getLevel, LEVEL_COUNT } from '../js/levels.js';
import { matchAt, mulberry32, E } from '../js/engine.js';
let bad = 0;
const rng = mulberry32(99);
for (let i = 0; i < LEVEL_COUNT; i++) {
  const L = getLevel(i), s = L.secret;
  const self = matchAt(L.model, L.grid, s.ry, s.rx, s.rz);
  const start = matchAt(L.model, L.grid, 0, 0, 0);
  let edgeMin = 1;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4, w = 2;
    edgeMin = Math.min(edgeMin, matchAt(L.model, L.grid, s.ry + Math.cos(a) * w, s.rx + Math.sin(a) * w, s.rz));
  }
  let lucky = 0;
  for (let n = 0; n < 300; n++) {
    const ry = -120 + rng() * 240, rx = -100 + rng() * 200, rz = L.hasRoll ? -90 + rng() * 180 : 0;
    if (matchAt(L.model, L.grid, ry, rx, rz) >= L.thr) lucky++;
  }
  let maxR = 0;
  L.model.forEach((f) => f.forEach((p) => { maxR = Math.max(maxR, Math.hypot(...p)); }));
  const ok = self > 0.99 && start < L.thr && edgeMin >= L.thr && maxR < E - 0.05;
  if (!ok) bad++;
  console.log(`#${i + 1} ${L.name} thr=${L.thr} start=${start.toFixed(2)} at2deg=${edgeMin.toFixed(2)} randomWins=${lucky}/300 roll=${L.hasRoll} meter=${L.meter} ${ok ? 'ok' : 'FAIL'}`);
}
console.log(bad ? 'FAIL ' + bad : 'ALL OK');
process.exit(bad ? 1 : 0);
