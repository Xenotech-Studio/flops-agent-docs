import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from './markdown.mjs';

test('escape raw HTML and reject unsafe links', () => {
  const { html } = renderMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert)\n\n[safe](/docs)');
  assert(!html.includes('<script>'));
  assert(!html.includes('href="javascript:'));
  assert(html.includes('href="/docs"'));
});
test('legacy escaped fences are code, not headings; source stays unchanged', () => {
  const source = '# Title\n\n\\`\\`\\`python\n# A code comment\nprint("hello")\n\\`\\`\\`\n\n## Next';
  const { html, headings } = renderMarkdown(source);
  assert.equal((html.match(/<h1 /g) || []).length, 1);
  assert(html.includes('# A code comment\nprint(&quot;hello&quot;)'));
  assert.deepEqual(headings.map(h => h.text), ['Next']);
  assert(source.includes('\\`\\`\\`'));
});
test('heading IDs, numbered lists, tables and reference links', () => {
  const { html, headings } = renderMarkdown('# Title\n\n## Repeat\n\n## Repeat\n\n3. Third\n4. Fourth\n\n| A | B |\n|---|---|\n| one | two |\n\n[Release]\n\n[Release]: https://example.test/release');
  assert.deepEqual(headings.map(h => h.id), ['docs-repeat', 'docs-repeat-1']);
  assert(html.includes('<ol start="3">'));
  assert(html.includes('<td>two</td>'));
  assert(html.includes('href="https://example.test/release"'));
});


test('Chinese summaries consume only translated metadata label separators', () => {
  for (const label of ['Reader question:', 'Prerequisites:', 'Outcome:']) {
    const translated = { 'Reader question:': '读者问题：', 'Prerequisites:': '前置条件：', 'Outcome:': '预期结果：' }[label];
    const prose = '使用 Flops 框架，保留 Python 产品中的空格。';
    assert.equal(renderMarkdown(`**${label}** ${prose}`, 'zh-CN').summary, translated + prose);
    assert.equal(renderMarkdown(`**${label}** Can I use Flops?`, 'en').summary, `${label} Can I use Flops?`);
  }
  assert.equal(renderMarkdown('**Prerequisites:** 使用 Python。 **Outcome:** 运行 Flops。', 'zh-CN').summary,
    '前置条件：使用 Python。 预期结果：运行 Flops。');
  const ordinary = '使用 Flops 框架， 保留原文。 **Outcome:** 普通正文';
  assert.equal(renderMarkdown(ordinary, 'zh-CN').summary, ordinary);
});
