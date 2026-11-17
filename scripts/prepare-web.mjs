import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
const out = 'www';
if (existsSync(out)) rmSync(out, { recursive: true });
mkdirSync(out);
for (const item of ['index.html', 'css', 'js', 'assets']) {
  if (existsSync(item)) cpSync(item, `${out}/${item}`, { recursive: true });
}
console.log('www ready: only index.html, css, js, assets copied (no keys, no tools)');
