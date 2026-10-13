import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { renderMarkdown } from './markdown.mjs';
const root = new URL('../../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const entries = JSON.parse(await read('website/scripts/docs-sources.json'));
const en = JSON.parse(await read('website/src/content/docs/_meta.json')).pages;
const zh = JSON.parse(await read('website/src/content/i18n/zh-CN/_meta.json')).pages;
const blocks = text => [...text.matchAll(/^```[^\n]*\n.*?^```/gms)].map(m => m[0]);
const prose = text => text.replace(/^```[^\n]*\n.*?^```/gms, '');
const shape = text => prose(text).split('\n').flatMap(line => {
  if (/^#{1,6} /.test(line)) return [line.match(/^#+/)[0]];
  if (/^\|/.test(line)) return ['table:' + line.split('|').length];
  if (/^[-*] /.test(line)) return ['list'];
  if (/^\d+\. /.test(line)) return ['ordered'];
  return [];
});
for (const entry of entries) test(`${entry.file}: structure, code, metadata, external URLs`, async () => {
  const original = await read(`docs/en/${entry.file}`);
  const translated = await read(`docs/zh-CN/${entry.file}`);
  assert.deepEqual(blocks(translated), blocks(original));
  assert.deepEqual(shape(translated), shape(original));
  const labels = text => [...text.matchAll(/\*\*(Reader question|Prerequisites|Outcome):\*\*/g)].map(m => m[1]);
  assert.deepEqual(labels(translated), labels(original));
  const urls = text => [...text.matchAll(/https?:\/\/[^\s)]+/g)].map(m => m[0]);
  assert.deepEqual(urls(translated), urls(original));
  const inlineCode = text => [...prose(text).matchAll(/`([^`]+)`/g)].map(m => m[1]);
  const targetCode = inlineCode(translated);
  for (const code of inlineCode(original)) assert.ok(targetCode.includes(code), `Missing code: ${code}`);
});
test('localized navigation, links, anchors and exports', async () => {
  assert.equal(zh.length, 17);
  const targets = new Map(zh.map(p => [p.href, p]));
  for (const page of zh) {
    assert.equal(page.lang, 'zh-CN');
    assert.equal(page.href, '/zh-CN' + en.find(p => p.slug === page.slug).href);
    for (const heading of en.find(p => p.slug === page.slug).headings) assert.ok(page.html.includes(`id="${heading.id}"`));
    for (const [, href] of page.html.matchAll(/href="([^"#]+)(?:#[^"]*)?"/g)) {
      if (href.startsWith('/docs')) assert.fail(`English link on translated page: ${href}`);
      if (href.startsWith('/zh-CN/docs') && !href.endsWith('.json')) assert.ok(targets.has(href), href);
    }
    assert.equal(await read(`website/public/docs-source/zh-CN/${page.slug}.md`), page.publicMarkdown);
    const output = await read(`website/dist${page.href}/index.html`);
    assert.ok(output.includes('<html lang="zh-CN">'));
    assert.equal((output.match(/rel="canonical"/g) ?? []).length, 1);
    for (const lang of ['en', 'zh-CN', 'x-default']) assert.ok(output.includes(`hreflang="${lang}"`));
  }
  for (const page of en) assert.equal(await read(`website/public/docs-source/${page.slug}.md`), page.publicMarkdown);
  assert.ok(!zh.find(p => p.slug === 'CHANGELOG').publicMarkdown.includes('[Unreleased]'));
});
test('renderer translates accessible labels', () => {
  const html = renderMarkdown('```py\na = 1\n```\n\n| 列 |\n|---|\n| 值 |', 'zh-CN').html;
  assert.ok(html.includes('代码块；可横向滚动'));
  assert.ok(html.includes('表格；可横向滚动'));
});
test('empty and partial translation builds keep English exports unchanged', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'flops-i18n-'));
  try {
    await cp(new URL('website/scripts/', root), join(dir, 'website/scripts'), { recursive: true });
    await mkdir(join(dir, 'website/src'), { recursive: true });
    await cp(new URL('website/src/i18n.json', root), join(dir, 'website/src/i18n.json'));
    await cp(new URL('docs/en/', root), join(dir, 'docs/en'), { recursive: true });
    await mkdir(join(dir, 'docs/zh-CN'), { recursive: true });
    const sync = () => execFileSync(process.execPath, [join(dir, 'website/scripts/sync-docs.mjs')]);
    sync();
    const metaPath = join(dir, 'website/src/content/i18n/zh-CN/_meta.json');
    assert.deepEqual(JSON.parse(await readFile(metaPath)).pages, []);
    await cp(new URL('docs/zh-CN/01-quick-start.md', root), join(dir, 'docs/zh-CN/01-quick-start.md'));
    sync();
    const partial = JSON.parse(await readFile(metaPath));
    assert.equal(partial.pages.length, 1);
    assert.ok(partial.pages[0].html.includes('href="/docs/02-core-concepts"'));
    assert.equal(await readFile(join(dir, 'website/public/docs-index.json'), 'utf8'), await read('website/public/docs-index.json'));
    for (const page of en) assert.equal(await readFile(join(dir, `website/public/docs-source/${page.slug}.md`), 'utf8'), page.publicMarkdown);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
