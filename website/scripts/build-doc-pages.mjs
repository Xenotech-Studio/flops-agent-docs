// Emit document entry points so metadata is available before JavaScript runs.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const template = await readFile(new URL('dist/index.html', root), 'utf8');
const en = JSON.parse(await readFile(new URL('src/content/docs/_meta.json', root), 'utf8')).pages;
const zh = JSON.parse(await readFile(new URL('src/content/i18n/zh-CN/_meta.json', root), 'utf8')).pages;
const origin = 'https://flops-agent.xenotech.studio';
const escape = value => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
for (const page of [...en, ...zh]) {
  const english = en.find(p => p.slug === page.slug);
  const chinese = zh.find(p => p.slug === page.slug);
  const links = `<link rel="canonical" href="${origin}${page.href}" />
    <link rel="alternate" hreflang="en" href="${origin}${english.href}" />
    ${chinese ? `<link rel="alternate" hreflang="zh-CN" href="${origin}${chinese.href}" />` : ''}
    <link rel="alternate" hreflang="x-default" href="${origin}${english.href}" />`;
  // Share the exact article HTML consumed by Docs.tsx on client navigation.
  const article = `<main id="docs-content" class="docs-main"><article class="docs-prose" lang="${page.lang}">${page.html}</article></main>`;
  const html = template.replace('<div id="root"></div>', () => `<div id="root">${article}</div>`).replace('<html lang="en">', `<html lang="${page.lang}">`)
    .replace(/<title>.*?<\/title>/s, `<title>${escape(page.title)} · flops-agent</title>`)
    .replace(/<link rel="canonical"[^>]*>/, links)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*/, `$1${escape(page.summary)}`)
    .replace(/(<meta property="og:locale" content=")[^"]*/, `$1${page.lang === 'en' ? 'en_US' : 'zh_CN'}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${origin}${page.href}`)
    .replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*/g, `$1${escape(page.title)} · flops-agent`)
    .replace(/(<meta (?:property="og:description"|name="twitter:description") content=")[^"]*/g, `$1${escape(page.summary)}`);
  for (const href of [page.href, ...(page.slug === 'overview' ? [page.href + '/overview'] : [])]) {
    const dir = new URL('dist' + href + '/', root);
    await mkdir(dir, { recursive: true });
    await writeFile(new URL('index.html', dir), html);
  }
}
// Known missing translations get an explicit fallback entry point (no 404).
for (const page of en.filter(p => !zh.some(z => z.slug === p.slug))) {
  for (const href of [page.href, ...(page.slug === 'overview' ? [page.href + '/overview'] : [])]) {
    const dir = new URL('dist/zh-CN' + href + '/', root);
    await mkdir(dir, { recursive: true });
    await writeFile(new URL('index.html', dir), template);
  }
}
console.log(`Generated document HTML for ${en.length} en and ${zh.length} zh-CN pages.`);
