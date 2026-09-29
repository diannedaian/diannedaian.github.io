// Package the existing frozen demo; never retrain or modify its model/rules.
// Usage: node scripts/package-arena.mjs /path/to/sap-rl-lab
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { englishText } from './arena-english.mjs';

if (!process.argv[2]) throw new Error('Provide the local sap-rl-lab repository path.');
const source = resolve(process.argv[2]);
const destination = fileURLToPath(new URL('../play/', import.meta.url));
const manifest = JSON.parse(await readFile(join(source, 'viewer/duel/manifest.json'), 'utf8'));
const assets = ['runtime.zip', 'model.npz', 'catalog.json', 'parity.npz'];
for (const name of assets) {
  const bytes = await readFile(join(source, 'viewer/duel', name));
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== manifest.files[name]) throw new Error(`Frozen asset checksum mismatch: ${name}`);
}

await mkdir(join(destination, 'duel'), { recursive: true });
for (const name of ['styles.css', 'play.css', 'model.js']) {
  await copyFile(join(source, 'viewer', name), join(destination, name));
}
for (const name of ['play.js', 'duel-worker.js']) {
  let code = await readFile(join(source, 'viewer', name), 'utf8');
  if (name === 'play.js') {
    code = "import {englishText} from './english.js';\n" + code
      .replace('b.frames[frame].message;', 'englishText(b.frames[frame].message);')
      .replaceAll('esc(d.label||d.action)', 'esc(englishText(d.label||d.action))')
      .replaceAll('esc(a.label||a.action)', 'esc(englishText(a.label||a.action))');
  }
  code = englishText(code);
  if (/\p{Script=Han}/u.test(code)) throw new Error(`Untranslated UI text in ${name}`);
  await writeFile(join(destination, name), code);
}
await copyFile(fileURLToPath(new URL('./arena-english.mjs', import.meta.url)), join(destination, 'english.js'));
for (const name of [...assets, 'manifest.json']) {
  await copyFile(join(source, 'viewer/duel', name), join(destination, 'duel', name));
}
const assetReadme = (await readFile(join(source, 'viewer/duel/README.md'), 'utf8'))
  .replace('`../play.html`', '`../index.html`')
  .replace('The old replay page remains at `../index.html`.', 'The article is at `../../blog/learning-rl-with-super-auto-pets.html`.');
await writeFile(join(destination, 'duel/README.md'), assetReadme);
await copyFile(join(source, 'LICENSE'), join(destination, 'LICENSE.txt'));

const original = await readFile(join(source, 'viewer/play.html'), 'utf8');
const replayLink = '<a href="index.html">历史回放</a>';
if (!original.includes(replayLink)) throw new Error('Source navigation changed; review packaging.');
const html = original
  .replace(replayLink, '<a href="../blog/learning-rl-with-super-auto-pets.html">← Back to the article</a>')
  .replace('<title>SAP RL · You vs Model</title>', '<title>Play against the bot — Dianne Cao</title>')
  .replace('<meta name="description"', '<link rel="canonical" href="https://diannedaian.github.io/play/">\n  <meta name="description"')
  .replace('<main class="duel-main">', `<main class="duel-main">
    <p class="small-note">Independent educational demo inspired by Super Auto Pets. Not affiliated with or endorsed by Team Wood Games. Frozen sandbox rules differ from the official game. Runs locally in your browser; no match data is uploaded. First load downloads Pyodide and NumPy from jsDelivr. <a href="https://github.com/diannedaian/sap-rl-lab">Source and limitations</a> · <a href="LICENSE.txt">Code license</a></p>`);
const englishHtml = englishText(html);
if (/\p{Script=Han}/u.test(englishHtml)) throw new Error('Untranslated page text');
await writeFile(join(destination, 'index.html'), englishHtml);
console.log('Packaged /play/ with unchanged, hash-verified model and rule assets. No deployment performed.');
