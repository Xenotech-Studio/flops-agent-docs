import { useState } from 'react'
import { localeFor, englishPath, translate } from './i18n'
import zhData from './content/i18n/zh-CN/_meta.json'
import ThemeToggle from './ThemeToggle'
// The header stays mounted across page changes so CSS can interpolate its width.
// This UI event opens the existing Docs search without coupling it to routing.
export const DOCS_SEARCH_EVENT = 'flops-docs-search'

export default function PublicHeader({ docs, path }: { docs: boolean; path: string }) {
  const locale = localeFor(path)
  const t = (text: string) => translate(locale, text)
  const [missing, setMissing] = useState('')
  const en = englishPath(path).replace(/\/$/, '') || '/'
  const zh = '/zh-CN' + en
  const available = zhData.pages.some((p: { href: string; slug: string }) => p.href === zh || (p.slug === 'overview' && en === '/docs/overview'))

  return <>
    <a className="skip-link" href={docs ? '#docs-content' : '#content'}>{t("Skip to content")}</a>
    <header className={`site-header ${docs ? 'docs-header' : 'home-header'}`} id="top">
      <div className="site-header-inner">
        <a className="brand" href={docs ? '/' : '#top'} aria-label={t("flops-agent home")}>
          <img className="brand-mark" src="/favicon-64.png?v=9339b14ffac0" width="31" height="31" alt="" aria-hidden="true" />
          <span>flops-agent</span>
        </a>
        <nav className="header-nav" aria-label={t("Main navigation")}>
          <a href={docs ? '/' : '#quick-start'}>{docs ? t("Home") : t("Quick start")}</a>
          <a href={locale === 'zh-CN' ? '/zh-CN/docs' : '/docs'} aria-current={docs ? 'page' : undefined}>{t("Docs")}</a>
        </nav>
        <div className="header-actions">
        {docs ? <button className="docs-search-button" onClick={() => window.dispatchEvent(new Event(DOCS_SEARCH_EVENT))}>{t("Search docs")} <kbd>⌘ K / Ctrl K</kbd></button> :
          <div className="public-links" aria-label={t("Project links")}>
            <a href="https://github.com/Xenotech-Studio/flops-agent" title={t("Public GitHub repository · MIT")}>GitHub <span className="external-mark" aria-hidden="true">↗</span></a>
            <a href="https://pypi.org/project/flops-agent/" title="PyPI · flops-agent 0.2.0">PyPI <span className="external-mark" aria-hidden="true">↗</span></a>
            <span className="link-status">MIT · 0.2.0</span>
          </div>}
          <nav className="language-switch" aria-label="Language / 语言">
            <a href={en} lang="en" aria-current={locale === 'en' ? 'page' : undefined} onClick={() => setMissing('')}>EN</a>
            <a href={available ? zh : en} lang="zh-CN" aria-current={locale === 'zh-CN' ? 'page' : undefined} onClick={event => { if (!available) { event.preventDefault(); setMissing(path) } else setMissing('') }}>中文</a>
          </nav>
          {(missing === path || new URLSearchParams(location.search).has('translation-missing')) && <span role="status">{t("暂无中文")}</span>}
          <ThemeToggle locale={locale} />
        </div>
      </div>
    </header>
  </>
}
