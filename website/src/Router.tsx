import { localeFor, englishPath, translate } from './i18n'
import data from './content/docs/_meta.json'
import zhData from './content/i18n/zh-CN/_meta.json'

function resolveTranslation() {
  if (localeFor(location.pathname) !== 'zh-CN') return
  const enPath = englishPath(location.pathname).replace(/\/$/, '')
  const en = data.pages.find(p => p.href === enPath || (p.slug === 'overview' && enPath === '/docs/overview'))
  if (en && !zhData.pages.some((p: { slug: string }) => p.slug === en.slug)) {
    history.replaceState(null, '', en.href + '?translation-missing=1' + location.hash)
  }
}
resolveTranslation()
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import App from './App'
import Docs from './Docs'
import PublicHeader from './PublicHeader'

export default function Router() {
  const [path, setPath] = useState(location.pathname)
  const [headerPath, setHeaderPath] = useState(location.pathname)
  const content = useRef<HTMLDivElement>(null)
  const displayed = useRef(path)
  useEffect(() => {
    let generation = 0
    let animations: Animation[] = []
    const cancelAnimations = () => { animations.forEach(animation => animation.cancel()); animations = [] }
    const previousRestoration = history.scrollRestoration
    history.scrollRestoration = 'manual'
    const land = (hash: string) => {
      if (hash) {
        try { document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: 'instant' }) } catch { /* Invalid fragment. */ }
      } else window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true })
    }
    const update = async () => {
      const ticket = ++generation
      cancelAnimations()
      resolveTranslation()
      const target = location.pathname
      const hash = location.hash
      const node = content.current!
      // Keep the documentation shell visible, including across locale changes.
      // Animate the two existing grid items to preserve sticky/responsive layout.
      const docsNavigation = displayed.current !== '/' && target !== '/'
      const targets = docsNavigation
        ? Array.from(node.querySelectorAll<HTMLElement>('.docs-main, .docs-outline'))
        : [node]
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
      const style = getComputedStyle(node)
      const time = style.getPropertyValue('--route-duration').trim()
      // Production CSS may normalize 180ms to .18s. WAAPI always takes ms.
      const duration = Number.parseFloat(time) * (time.endsWith('ms') ? 1 : 1000) / 2
      const easing = style.getPropertyValue('--route-easing').trim()
      const started = performance.now()
      const changed = target !== displayed.current
      flushSync(() => setHeaderPath(target))
      if (changed && !reduced) {
        animations = targets.map(target => target.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing, fill: 'forwards' }))
        try { await Promise.all(animations.map(animation => animation.finished)) } catch { return }
      }
      if (ticket !== generation) return
      flushSync(() => { displayed.current = target; setPath(target) })
      land(hash)
      cancelAnimations()
      if (changed && !reduced) {
        const incoming = docsNavigation
          ? Array.from(node.querySelectorAll<HTMLElement>('.docs-main, .docs-outline'))
          : [node]
        animations = incoming.map(target => target.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Math.max(0, duration * 2 - (performance.now() - started)), easing }))
        try { await Promise.all(animations.map(animation => animation.finished)) } catch { /* A newer navigation takes over. */ }
      }
    }
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element).closest('a')
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href)
      if (url.origin !== location.origin || !/^\/(?:zh-CN\/)?(?:docs(?:\/[^/]+)?\/?)?$/.test(url.pathname)) return
      if (url.pathname === location.pathname && url.hash) return
      event.preventDefault()
      history.pushState(null, '', url)
      void update()
    }
    const onPopState = () => { void update() }
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const onMotionChange = () => { if (media.matches) void update() }
    media.addEventListener('change', onMotionChange)
    window.addEventListener('popstate', onPopState)
    document.addEventListener('click', click)
    return () => {
      ++generation; cancelAnimations()
      history.scrollRestoration = previousRestoration
      media.removeEventListener('change', onMotionChange)
      window.removeEventListener('popstate', onPopState)
      document.removeEventListener('click', click)
    }
  }, [])
  useEffect(() => {
    const locale = localeFor(path)
    document.documentElement.lang = locale
    const pages = locale === 'en' ? data.pages : zhData.pages
    const normalized = path.replace(/\/$/, '')
    const page = pages.find(p => p.href === normalized || (p.slug === 'overview' && englishPath(normalized) === '/docs/overview'))
    const title = path === '/' ? 'flops-agent — A ready-to-integrate framework for server-side agents' : `${page?.title ?? translate(locale, 'Document not found')} · flops-agent`
    const description = path === '/' ? translate('en', 'Home description') : page?.summary ?? ''
    for (const [selector, value] of [
      ['meta[property="og:image:alt"], meta[name="twitter:image:alt"]', translate(locale, 'Social image alt')],
      ['meta[property="og:title"], meta[name="twitter:title"]', title],
      ['meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', description],
      ['meta[property="og:locale"]', locale === 'en' ? 'en_US' : 'zh_CN'],
      ['meta[property="og:url"]', new URL(page?.href ?? path, 'https://flops-agent.xenotech.studio').href],
    ]) {
      document.querySelectorAll(selector).forEach(meta => meta.setAttribute('content', value))
    }
    if (path === '/') {
      document.title = 'flops-agent — A ready-to-integrate framework for server-side agents'
      document.querySelectorAll('link[rel=canonical], link[hreflang]').forEach(link => link.remove())
      const canonical = document.createElement('link')
      canonical.rel = 'canonical'; canonical.href = 'https://flops-agent.xenotech.studio/'
      document.head.append(canonical)
    }
  }, [path])
  return <>
    <PublicHeader docs={headerPath !== '/'} path={headerPath} />
    <div className="route-content" ref={content}>
      {path === '/' ? <App /> : <Docs path={path} />}
    </div>
  </>
}
