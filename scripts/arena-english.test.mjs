import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {englishText} from './arena-english.mjs';

test('runtime shopping labels and opening battle message translate', () => {
  const labels = ['结束回合', '刷新商店', '购买 Fish', 'Apple → 0 号 Fish',
    '买入合成 Fish → 0 号', '解冻 Fish', '冻结 Fish', '卖出 0 号 Fish',
    '交换 0 号 Fish ↔ 1 号 Ant', '合成 0 号 Fish → 1 号',
    '双方回合结束效果已结算 · 开始战斗'];
  for (const text of labels) assert.doesNotMatch(englishText(text), /\p{Script=Han}/u);
  assert.equal(englishText('购买 Fish'), 'Buy Fish');
  assert.equal(englishText('解冻 Fish'), 'Unfreeze Fish');
  assert.equal(englishText('冻结 Fish'), 'Freeze Fish');
  assert.equal(englishText('双方回合结束效果已结算 · 开始战斗'), 'End-turn effects resolved · Battle begins');
  assert.equal(englishText('<Fish> & 10'), '<Fish> & 10'); // caller still escapes HTML
});

test('generated controls are English and runtime labels use the adapter', async () => {
  for (const name of ['index.html', 'play.js', 'duel-worker.js']) {
    const text = await readFile(new URL(`../play/${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /\p{Script=Han}/u, name);
  }
  const html = await readFile(new URL('../play/index.html', import.meta.url), 'utf8');
  assert.match(html, /lang="en"/);
  assert.match(html, /End turn → Battle/);
  const js = await readFile(new URL('../play/play.js', import.meta.url), 'utf8');
  assert.match(js, /englishText\(b\.frames\[frame\]\.message\)/);
  assert.match(js, /esc\(englishText\(d\.label\|\|d\.action\)\)/);
});

test('translated presentation preserves frozen rules and inference assets', async () => {
  const manifest = JSON.parse(await readFile(new URL('../play/duel/manifest.json', import.meta.url)));
  for (const name of ['runtime.zip', 'model.npz', 'catalog.json', 'parity.npz']) {
    const bytes = await readFile(new URL(`../play/duel/${name}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.files[name], name);
  }
});
