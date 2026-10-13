import { useEffect, useRef, useState } from 'react'
import data from './content/docs/_meta.json'
import zhData from './content/i18n/zh-CN/_meta.json'
import { localeFor, englishPath, translate } from './i18n'
import './Docs.css'
import { DOCS_SEARCH_EVENT } from './PublicHeader'
type Pages = typeof data.pages

function Search({ close, pages, path }: { close: () => void; pages: Pages; path: string }) {
  const t = (text: string) => translate(localeFor(path), text)
  const dialog = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const results = pages.filter(p => tokens.every(t => `${p.title} ${p.group} ${p.markdown}`.toLowerCase().includes(t)))
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    return () => { dialog.current?.close(); opener?.focus() }
  }, [])
  useEffect(() => { document.getElementById(`search-result-${selected}`)?.scrollIntoView({ block: 'nearest' }) }, [selected])
  return <dialog ref={dialog} className="docs-search" aria-label={t("Search docs")} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close() }}>
    <div className="docs-search-row"><input autoFocus aria-label={t("Search docs")} placeholder={t("Search titles, chapters, or content…")} value={query} onChange={e => { setQuery(e.target.value); setSelected(0) }} onKeyDown={e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (results.length) setSelected((selected + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length) }
      if (e.key === 'Enter' && !e.nativeEvent.isComposing) document.getElementById(`search-result-${selected}`)?.click()
    }} /><button onClick={close} aria-label={t("Close search")}>{t("Close")}</button></div>
    <div className="docs-results">{results.map((p, index) => <a id={`search-result-${index}`} key={p.slug} href={p.href} className={selected === index ? 'selected' : ''} onClick={close}><small>{p.group}</small><strong>{p.title}</strong><span>{p.summary}</span></a>)}{!results.length && <p role="status">{t("No matching documents")}</p>}</div>
    <p className="docs-search-help">{t("↑↓ Select · Enter Open · Esc Close")}</p>
  </dialog>
}

export default function Docs({ path }: { path: string }) {
  const locale = localeFor(path)
  const t = (text: string) => translate(locale, text)
  const { pages, sections } = (locale === 'zh-CN' ? zhData : data) as typeof data
  const normalized = path.replace(/\/$/, '')
  const page = pages.find(p => p.href === normalized || (p.slug === 'overview' && englishPath(normalized) === '/docs/overview'))
  const [menu, setMenu] = useState(false)
  const [search, setSearch] = useState(false)
  const [copy, setCopy] = useState(t("Copy page Markdown"))
  const [active, setActive] = useState('')
  useEffect(() => {
    document.title = `${page?.title ?? t("Document not found")} · flops-agent`
    document.documentElement.lang = locale
    document.querySelectorAll('link[rel=canonical], link[hreflang]').forEach(link => link.remove())
    const links: HTMLLinkElement[] = []
    if (page) {
      const en = data.pages.find(p => p.slug === page.slug)!
      const zh = (zhData.pages as Pages).find(p => p.slug === page.slug)
      for (const [rel, language, href] of [
        ['canonical', '', page.href], ['alternate', 'en', en.href],
        ...(zh ? [['alternate', 'zh-CN', zh.href]] : []), ['alternate', 'x-default', en.href],
      ]) {
        const link = document.createElement('link')
        link.rel = rel
        if (language) link.hreflang = language
        link.href = new URL(href, 'https://flops-agent.xenotech.studio').href
        document.head.append(link); links.push(link)
      }
    }
    const key = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearch(s => !s) } }
    const openSearch = () => setSearch(true)
    window.addEventListener(DOCS_SEARCH_EVENT, openSearch)
    window.addEventListener('keydown', key)
    if (location.hash) { try { document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView() } catch { /* Malformed URL fragment. */ } }
    const update = () => {
      let current = page?.headings[0]?.id ?? ''
      for (const heading of page?.headings ?? []) if ((document.getElementById(heading.id)?.getBoundingClientRect().top ?? Infinity) < 140) current = heading.id
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) current = page?.headings.at(-1)?.id ?? current
      setActive(current)
    }
    update(); window.addEventListener('scroll', update, { passive: true })
    return () => { links.forEach(link => link.remove()); window.removeEventListener(DOCS_SEARCH_EVENT, openSearch); window.removeEventListener('keydown', key); window.removeEventListener('scroll', update) }
  }, [page])
  async function copyMarkdown() {
    try { await navigator.clipboard.writeText(page!.publicMarkdown); setCopy(t("Copied")) }
    catch { setCopy(t("Copy failed; open the raw Markdown")) }
  }
  const section = sections.find(section => section.id === page?.section)
  const sectionPages = section?.navigation === false || !page ? pages : pages.filter(p => p.section === page.section)
  const groups = [...new Set(sectionPages.map(p => p.group))]
  const index = page ? sectionPages.indexOf(page) : -1
  return <div className="docs-page">
    <div className="docs-area-bar"><nav className="docs-area-inner" aria-label={t("Documentation areas")}>{sections.filter(section => section.navigation !== false).map(section => <a key={section.id} href={section.href} aria-current={section.id === page?.section ? 'page' : undefined}>{section.title}</a>)}</nav></div>
    <div className="docs-layout">
      <aside className="docs-sidebar"><button className="docs-menu-toggle" aria-expanded={menu} aria-controls="docs-navigation" onClick={() => setMenu(!menu)}>{t("Documentation menu")} <span>{menu ? '−' : '+'}</span></button><nav id="docs-navigation" className={menu ? 'open' : ''} aria-label={t("Documentation menu")}>{groups.map(group => <div className="docs-group" key={group}><p>{group}</p>{sectionPages.filter(p => p.group === group).map(p => <a key={p.slug} href={p.href} aria-current={p === page ? 'page' : undefined}>{p.title}</a>)}</div>)}</nav><a className="docs-repo" href="https://github.com/Xenotech-Studio/flops-agent">GitHub ↗</a></aside>
      <main id="docs-content" tabIndex={-1} className="docs-main">{page ? <>
        <div className="docs-breadcrumb"><a href={locale === 'zh-CN' ? '/zh-CN/docs' : '/docs'}>{t("Docs")}</a><span>/</span><a href={section?.href}>{section?.title}</a><span>/</span><span>{page.group}</span></div>
        <div className="docs-tools"><button onClick={copyMarkdown}><span aria-live="polite">{copy}</span></button><a href={`/docs-source/${locale === 'zh-CN' ? 'zh-CN/' : ''}${page.slug}.md`}>{t("Raw Markdown ↗")}</a></div>
        <article className="docs-prose" lang={page.lang} dangerouslySetInnerHTML={{ __html: page.html }} />
        <nav className="docs-pagination" aria-label={t("Previous and next pages")}>{index > 0 ? <a href={sectionPages[index - 1].href}><small>{t("← Previous")}</small>{sectionPages[index - 1].title}</a> : <span />}{index < sectionPages.length - 1 && <a href={sectionPages[index + 1].href}><small>{t("Next →")}</small>{sectionPages[index + 1].title}</a>}</nav>
        <footer className="docs-footer">flops-agent · MIT <a href={locale === 'zh-CN' ? '/zh-CN/docs-index.json' : '/docs-index.json'}>{t("Documentation index JSON ↗")}</a></footer>
      </> : <div className="docs-not-found"><p>{t("404 / DOCUMENTATION")}</p><h1>{t("Document not found")}</h1><p>{t("This address is not in the public documentation manifest.")}</p><a href={locale === 'zh-CN' ? '/zh-CN/docs' : '/docs'}>{t("Back to documentation →")}</a></div>}</main>
      {page && <aside className="docs-outline"><nav aria-label={t("On this page")}><p>{t("On this page")}</p>{page.headings.map(h => <a key={h.id} href={`#${h.id}`} data-level={h.level} aria-current={active === h.id ? 'location' : undefined}>{h.text}</a>)}</nav></aside>}
    </div>{search && <Search pages={pages} path={path} close={() => setSearch(false)} />}
  </div>
}
