import { getLevel, LEVEL_COUNT } from '../js/levels.js';
import { matchAt, E } from '../js/engine.js';
let bad = 0;
for (let i = 0; i < LEVEL_COUNT; i++) {
  const t = Date.now(), L = getLevel(i);
  const self = matchAt(L.model, L.grid, L.secret.ry, L.secret.rx);
  let maxR = 0;
  L.model.forEach((f) => f.forEach((p) => { maxR = Math.max(maxR, Math.hypot(...p)); }));
  const ok = self > 0.99 && maxR < E - 0.05 && L.startIou <= 0.8;
  if (!ok) bad++;
  console.log(`#${i + 1} ${L.name} secret=(${L.secret.ry.toFixed(0)},${L.secret.rx.toFixed(0)}) widthDeg=${L.width} startIoU=${L.startIou.toFixed(2)} area=${(L.area * 100).toFixed(0)}% radius=${maxR.toFixed(2)} ok=${ok} ${Date.now() - t}ms`);
}
console.log(bad ? 'FAIL' : 'ALL OK');
process.exit(bad ? 1 : 0);
