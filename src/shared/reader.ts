/** Okuyucu modu: sayfanin ana yazisini bulup sade, okunakli bir duzende gosterir. Sayfa dunyasinda calisir; cikis = sayfayi yeniden yukle. */
export const readerScript = (lang: 'en' | 'tr'): string => `(() => {
  const L = ${JSON.stringify(lang === 'tr' ? { min: 'dk okuma', close: 'Kapat', light: 'Açık', sepia: 'Sepya', dark: 'Koyu' } : { min: 'min read', close: 'Close', light: 'Light', sepia: 'Sepia', dark: 'Dark' })}
  const de = document.documentElement
  if (de.dataset.dbReader === '1') { location.reload(); return 'exit' }
  const BAD = /comment|sidebar|footer|nav|menu|promo|advert|related|share|social|newsletter|cookie|popup|modal|subscribe|breadcrumb/i
  const score = new Map()
  for (const p of document.querySelectorAll('p')) {
    const len = (p.textContent || '').trim().length
    if (len < 60) continue
    let n = p.parentElement, w = 1
    for (let i = 0; i < 3 && n; i++, n = n.parentElement, w /= 2) {
      if (BAD.test((n.className || '') + ' ' + (n.id || '')) && n.tagName !== 'ARTICLE') continue
      score.set(n, (score.get(n) || 0) + len * w)
    }
  }
  let best = null, top = 0
  for (const [n, s] of score) { const v = n.tagName === 'ARTICLE' ? s * 1.5 : s; if (v > top) { top = v; best = n } }
  if (!best || top < 300) return 'none'
  const clone = best.cloneNode(true)
  for (const el of clone.querySelectorAll('script,style,iframe,form,nav,aside,footer,button,input,select,textarea,noscript,svg,canvas,video,audio,object,embed,link,meta,[hidden],[aria-hidden="true"]')) el.remove()
  for (const el of [...clone.querySelectorAll('*')]) {
    if (BAD.test((el.className && el.className.baseVal === undefined ? el.className : '') + ' ' + (el.id || '')) && !/^(P|H[1-6]|ARTICLE|IMG|FIGURE|UL|OL|LI|BLOCKQUOTE|PRE|CODE|A|SPAN|EM|STRONG|B|I)$/.test(el.tagName)) { el.remove(); continue }
    for (const a of [...el.attributes]) {
      const n = a.name
      if (n === 'href' && /^(https?:|mailto:)/i.test(a.value)) continue
      if (n === 'src' && /^(https?:|data:image\\/)/i.test(a.value)) continue
      if (n === 'alt' || n === 'colspan' || n === 'rowspan') continue
      el.removeAttribute(n)
    }
    if (el.tagName === 'A') { el.target = '_blank'; el.rel = 'noopener noreferrer' }
  }
  const h1 = clone.querySelector('h1') || document.querySelector('h1')
  const title = (h1 && h1.textContent.trim()) || document.title
  if (clone.querySelector('h1')) clone.querySelector('h1').remove()
  const words = (clone.textContent || '').trim().split(/\\s+/).length
  document.querySelectorAll('link[rel~="stylesheet"],style').forEach((s) => s.remove())
  const css = document.createElement('style')
  css.textContent = ':root{--fs:19px;--bg:#fbf9f4;--fg:#222;--mut:#777;--ln:#2b6cb0}:root[data-rt="sepia"]{--bg:#f4ecd8;--fg:#433422;--mut:#8a7a62}:root[data-rt="dark"]{--bg:#16171a;--fg:#d8d8d8;--mut:#888;--ln:#7fb2ff}@media(prefers-color-scheme:dark){:root:not([data-rt]){--bg:#16171a;--fg:#d8d8d8;--mut:#888;--ln:#7fb2ff}}'
    + 'html,body{background:var(--bg)!important;color:var(--fg)!important;margin:0}.db-reader{max-width:680px;margin:0 auto;padding:72px 24px 120px;font:var(--fs)/1.7 Georgia,"Iowan Old Style",serif}.db-reader h1{font:700 1.9em/1.2 -apple-system,"SF Pro Display",sans-serif;margin:0 0 .3em}.db-reader .meta{color:var(--mut);font:14px -apple-system,sans-serif;margin-bottom:2em}.db-reader img{max-width:100%;height:auto;border-radius:6px}.db-reader a{color:var(--ln)}.db-reader pre{overflow:auto;background:rgba(127,127,127,.12);padding:12px;border-radius:6px;font-size:.8em}.db-reader blockquote{margin:1em 0;padding-left:1em;border-left:3px solid rgba(127,127,127,.4);color:var(--mut)}.db-reader table{border-collapse:collapse}.db-reader td,.db-reader th{border:1px solid rgba(127,127,127,.3);padding:4px 8px}'
    + '.db-rbar{position:fixed;top:12px;right:16px;display:flex;gap:6px;font:13px -apple-system,sans-serif;z-index:2147483647}.db-rbar button{all:unset;cursor:pointer;padding:5px 10px;border-radius:8px;background:rgba(127,127,127,.18);color:var(--fg)}.db-rbar button:hover{background:rgba(127,127,127,.32)}'
  document.head.appendChild(css)
  const wrap = document.createElement('div'); wrap.className = 'db-reader'
  const h = document.createElement('h1'); h.textContent = title
  const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = location.hostname + ' · ' + Math.max(1, Math.round(words / 200)) + ' ' + L.min
  wrap.append(h, meta, clone)
  const bar = document.createElement('div'); bar.className = 'db-rbar'
  const btn = (t, f) => { const b = document.createElement('button'); b.textContent = t; b.onclick = f; bar.appendChild(b); return b }
  const fs = (d) => { const c = parseFloat(getComputedStyle(de).getPropertyValue('--fs')) || 19; de.style.setProperty('--fs', Math.min(30, Math.max(14, c + d)) + 'px') }
  btn('A−', () => fs(-1)); btn('A+', () => fs(1))
  let ti = 0; const themes = [['light', L.light], ['sepia', L.sepia], ['dark', L.dark]]
  btn(L.sepia, function () { ti = (ti + 1) % themes.length; de.dataset.rt = themes[ti][0]; this.textContent = themes[(ti + 1) % themes.length][1] })
  btn(L.close, () => location.reload())
  de.dataset.dbReader = '1'; de.dataset.rt = 'light'
  document.body.replaceChildren(wrap, bar); window.scrollTo(0, 0)
  return 'ok'
})()`
