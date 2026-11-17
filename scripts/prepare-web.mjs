// Copies only the game into www/. With --release all levels are locked again
// (TEST_UNLOCK_ALL = false) so the APK ships normal progression, while the repo
// and GitHub Pages keep everything open for testing.
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
const release = process.argv.includes('--release');
const out = 'www';
if (existsSync(out)) rmSync(out, { recursive: true });
mkdirSync(out);
for (const item of ['index.html', 'privacy.html', 'css', 'js', 'assets']) {
  if (existsSync(item)) cpSync(item, `${out}/${item}`, { recursive: true });
}
if (release) {
  const p = `${out}/js/main.js`;
  const s = readFileSync(p, 'utf8');
  if (!s.includes('const TEST_UNLOCK_ALL = true;') && !s.includes('const TEST_UNLOCK_ALL = false;')) throw new Error('TEST_UNLOCK_ALL not found');
  writeFileSync(p, s.replace('const TEST_UNLOCK_ALL = true;', 'const TEST_UNLOCK_ALL = false;'));
}
console.log(`www ready${release ? ' (release: levels locked)' : ''}: only game files copied (no keys, no tools)`);
