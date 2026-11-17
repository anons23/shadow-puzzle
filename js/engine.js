export const E = 2.2;
export const GRID = 72;
const R0 = 1.7;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function box(cx, cy, cz, sx, sy, sz) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  return [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]].map((f) => f.map((i) => v[i]));
}

export function prism(cx, cy, cz, r, h, n) {
  const top = [], bot = [], faces = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    top.push([cx + Math.cos(a) * r, cy + h / 2, cz + Math.sin(a) * r]);
    bot.push([cx + Math.cos(a) * r, cy - h / 2, cz + Math.sin(a) * r]);
  }
  faces.push(top, bot);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push([bot[i], bot[j], top[j], top[i]]); }
  return faces;
}

export function cone(cx, cy, cz, r, h, n) {
  const base = [], faces = [], apex = [cx, cy + h, cz];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; base.push([cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r]); }
  faces.push(base);
  for (let i = 0; i < n; i++) faces.push([base[i], base[(i + 1) % n], apex]);
  return faces;
}

function roof(w, y0, y1, d) {
  const a = [-w, y0, d], b = [w, y0, d], c = [0, y1, d], a2 = [-w, y0, -d], b2 = [w, y0, -d], c2 = [0, y1, -d];
  return [[a, b, c], [a2, b2, c2], [a, c, c2, a2], [b, c, c2, b2], [a, b, b2, a2]];
}

export const TEMPLATES = {
  angle: { name: 'Уголок', build: () => [...box(-0.55, 0, 0, 0.5, 1.8, 0.5), ...box(0.3, -0.65, 0, 1.2, 0.5, 0.5)] },
  tee: { name: 'Тавр', build: () => [...box(0, 0.7, 0, 1.8, 0.45, 0.5), ...box(0, -0.3, 0, 0.45, 1.8, 0.5)] },
  stairs: { name: 'Ступени', build: () => [...box(-0.7, -0.6, 0, 0.7, 0.6, 1.2), ...box(0, -0.3, 0, 0.7, 1.2, 1.2), ...box(0.7, 0, 0, 0.7, 1.8, 1.2)] },
  cross: { name: 'Крест', build: () => [...box(0, 0, 0, 2, 0.4, 0.4), ...box(0, 0, 0, 0.4, 2, 0.4), ...box(0, 0, 0, 0.4, 0.4, 2)] },
  frame: { name: 'Рамка', build: () => [...box(0, 0.8, 0, 1.8, 0.3, 0.3), ...box(0, -0.8, 0, 1.8, 0.3, 0.3), ...box(-0.8, 0, 0, 0.3, 1.9, 0.3), ...box(0.8, 0, 0, 0.3, 1.9, 0.3), ...box(0, 0, 0, 0.25, 0.25, 1.6)] },
  chair: { name: 'Стул', build: () => {
    const f = [...box(0, 0, 0, 1.2, 0.15, 1.2), ...box(0, 0.7, -0.52, 1.2, 1.25, 0.15)];
    for (const sx of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) f.push(...box(sx, -0.65, sz, 0.15, 1.15, 0.15));
    return f;
  } },
  table: { name: 'Стол', build: () => {
    const f = [...box(0, 0.5, 0, 2, 0.18, 1.2)];
    for (const sx of [-0.85, 0.85]) for (const sz of [-0.45, 0.45]) f.push(...box(sx, -0.2, sz, 0.16, 1.4, 0.16));
    return f;
  } },
  tree: { sym: true, name: 'Дерево', build: () => [...prism(0, -0.6, 0, 0.16, 1.0, 8), ...cone(0, -0.3, 0, 0.9, 1.3, 8), ...cone(0, 0.5, 0, 0.6, 1.0, 8)] },
  house: { name: 'Домик', build: () => [...box(0, -0.4, 0, 1.5, 1.0, 1.1), ...roof(0.85, 0.1, 0.95, 0.65), ...box(0.45, 0.8, 0, 0.2, 0.5, 0.2)] },
  mushroom: { sym: true, name: 'Гриб', build: () => [...prism(0, -0.5, 0, 0.25, 1.0, 8), ...prism(0, 0.2, 0, 0.95, 0.45, 10), ...cone(0, 0.42, 0, 0.5, 0.35, 10)] },
  lamp: { sym: true, name: 'Лампа', build: () => [...prism(0, -0.9, 0, 0.55, 0.15, 10), ...prism(0, -0.2, 0, 0.07, 1.4, 6), ...prism(0, 0.7, 0, 0.6, 0.5, 10)] },
  rocket: { sym: true, name: 'Ракета', build: () => [...prism(0, 0, 0, 0.45, 1.6, 10), ...cone(0, 0.8, 0, 0.45, 0.8, 10), ...box(-0.6, -0.7, 0, 0.5, 0.6, 0.1), ...box(0.6, -0.7, 0, 0.5, 0.6, 0.1), ...box(0, -0.7, -0.6, 0.1, 0.6, 0.5), ...box(0, -0.7, 0.6, 0.1, 0.6, 0.5)] },
  arch: { name: 'Арка', build: () => [...box(-0.8, -0.2, 0, 0.4, 1.6, 0.5), ...box(0.8, -0.2, 0, 0.4, 1.6, 0.5), ...box(0, 0.75, 0, 2, 0.35, 0.5), ...box(0, 1.15, 0, 0.5, 0.45, 0.3)] },
};

function bounds(faces) {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  faces.forEach((f) => f.forEach((p) => p.forEach((v, k) => { lo[k] = Math.min(lo[k], v); hi[k] = Math.max(hi[k], v); })));
  return { lo, hi };
}

export function normalize(faces, radius) {
  const { lo, hi } = bounds(faces);
  const c = lo.map((v, k) => (v + hi[k]) / 2);
  let m = 0;
  faces.forEach((f) => f.forEach((p) => { m = Math.max(m, Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2])); }));
  const s = radius / m;
  return faces.map((f) => f.map((p) => [(p[0] - c[0]) * s, (p[1] - c[1]) * s, (p[2] - c[2]) * s]));
}

export function buildModel(keys) {
  if (keys.length === 1) return normalize(TEMPLATES[keys[0]].build(), R0);
  const offs = [-0.95, 0.95];
  const out = [];
  keys.forEach((k, i) => {
    const part = normalize(TEMPLATES[k].build(), 1.0);
    part.forEach((f) => out.push(f.map((p) => [p[0] + offs[i], p[1], p[2]])));
  });
  return out;
}

export function rotateFaces(faces, ryDeg, rxDeg) {
  const a = (ryDeg * Math.PI) / 180, b = (rxDeg * Math.PI) / 180;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  return faces.map((f) => f.map((p) => {
    const x1 = p[0] * ca + p[2] * sa, z1 = -p[0] * sa + p[2] * ca;
    return [x1, p[1] * cb - z1 * sb, p[1] * sb + z1 * cb];
  }));
}

export function shadowPolys(faces, ryDeg, rxDeg) {
  return rotateFaces(faces, ryDeg, rxDeg).map((f) => f.map((p) => [p[0], p[1]]));
}

export function rasterize(polys) {
  const R = GRID, grid = new Uint8Array(R * R), k = R / (2 * E);
  for (const poly of polys) {
    const pts = poly.map((p) => [(p[0] + E) * k, (E - p[1]) * k]);
    let y0 = 1e9, y1 = -1e9;
    pts.forEach((p) => { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    for (let j = Math.max(0, Math.ceil(y0 - 0.5)); j <= Math.min(R - 1, Math.floor(y1 - 0.5)); j++) {
      const yc = j + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((u, v) => u - v);
      for (let q = 0; q + 1 < xs.length; q += 2) {
        for (let i = Math.max(0, Math.ceil(xs[q] - 0.5)); i <= Math.min(R - 1, Math.floor(xs[q + 1] - 0.5)); i++) grid[j * R + i] = 1;
      }
    }
  }
  return grid;
}

export function iou(a, b) {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] && b[i]) inter++; if (a[i] || b[i]) uni++; }
  return uni ? inter / uni : 0;
}

export function areaFraction(g) {
  let s = 0;
  for (let i = 0; i < g.length; i++) s += g[i];
  return s / g.length;
}

export function matchAt(model, targetGrid, ry, rx) {
  return iou(rasterize(shadowPolys(model, ry, rx)), targetGrid);
}
