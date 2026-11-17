// Run after `npx cap add android` / `npx cap sync android`:
// locks portrait orientation and sets versionName/versionCode from package.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const [ma, mi, pa] = pkg.version.split('.').map(Number);
const code = ma * 10000 + mi * 100 + pa;

const man = 'android/app/src/main/AndroidManifest.xml';
if (!existsSync(man)) throw new Error('No android project: run `npx cap add android` first');
let m = readFileSync(man, 'utf8');
if (!m.includes('android:screenOrientation')) m = m.replace(/<activity\b/, '<activity android:screenOrientation="portrait"');
writeFileSync(man, m);

const gr = 'android/app/build.gradle';
let g = readFileSync(gr, 'utf8');
g = g.replace(/versionCode\s+\d+/, `versionCode ${code}`).replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`);
writeFileSync(gr, g);
console.log(`android patched: portrait, version ${pkg.version} (${code})`);
