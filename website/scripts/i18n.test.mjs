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

test('metadata labels translate only known paragraph structures', () => {
  const source = '**Reader question:** Q\n\n**Prerequisites:** P. **Outcome:** O\n\n**Outcome:** O';
  assert.equal(renderMarkdown(source, 'zh-CN').html, '<p><strong>读者问题：</strong> Q</p><p><strong>前置条件：</strong> P. <strong>预期结果：</strong> O</p><p><strong>预期结果：</strong> O</p>');
  assert.equal(renderMarkdown(source).html, '<p><strong>Reader question:</strong> Q</p><p><strong>Prerequisites:</strong> P. <strong>Outcome:</strong> O</p><p><strong>Outcome:</strong> O</p>');
  for (const ordinary of ['Outcome is prose.', 'Text **Outcome:** stays.', '**Outcome**', '# **Reader question:**', '- **Prerequisites:**', '> **Outcome:**', '`**Outcome:**`', '[**Outcome:**](https://example.com)', '```\n<p><strong>Reader question:</strong>\n```', '<p><strong>Outcome:</strong>']) {
    assert.equal(renderMarkdown(ordinary, 'zh-CN').html.replace('代码块；可横向滚动', 'Code block; scroll horizontally'), renderMarkdown(ordinary).html, ordinary);
  }
});

test('exports keep canonical tokens; static and client articles share localized HTML', async () => {
  const tokens = ['Reader question:', 'Prerequisites:', 'Outcome:'];
  const labels = ['读者问题：', '前置条件：', '预期结果：'];
  for (const [lang, pages] of [['en', en], ['zh-CN', zh]]) {
    for (const page of pages) {
      const output = await read(`website/dist${page.href}/index.html`);
      assert.ok(output.includes(`<article class="docs-prose" lang="${lang}">${page.html}</article>`));
      for (const [index, token] of tokens.entries()) {
        if (!page.markdown.includes(`**${token}**`)) continue;
        assert.ok(page.publicMarkdown.includes(`**${token}**`));
        assert.ok(page.html.includes(`<strong>${lang === 'en' ? token : labels[index]}</strong>`));
        if (lang === 'zh-CN') assert.ok(!page.html.includes(`<strong>${token}</strong>`));
      }
    }
    const quick = pages.find(p => p.slug === '01-quick-start');
    assert.ok(quick.summary.startsWith(lang === 'en' ? 'Reader question:' : '读者问题：'));
    assert.ok(!quick.summary.includes('**'));
    const canonical = await read(`docs/${lang}/01-quick-start.md`);
    for (const token of tokens) assert.ok(canonical.includes(`**${token}**`));
    for (const label of labels) assert.ok(!pages.find(p => p.slug === '01-quick-start').publicMarkdown.includes(`**${label}**`));
  }
});
