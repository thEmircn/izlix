// Recorder: kullanici akisini kaydedip Playwright testine donusturme. Sayfa betigi (saf dizge) + adim modeli + disa aktarma.
export const REC_BINDING = '__dbRec'
export type Sel = { k: 'testid' | 'placeholder' | 'label' | 'text' | 'css'; v: string } | { k: 'role'; role: string; name: string }
export type Step =
  | { t: 'goto'; url: string }
  | { t: 'click'; sel: Sel }
  | { t: 'fill'; sel: Sel; value: string; secret?: boolean }
  | { t: 'select'; sel: Sel; value: string }
  | { t: 'press'; sel: Sel; key: string }

/** Sayfa betigi: yalnizca guvenilir (kullanici) olaylari yakalar; parola alanlarinin degeri ASLA gonderilmez. */
export const REC_SCRIPT = `(() => {
  if (window.__dbRecInit) return
  window.__dbRecInit = true
  const send = (o) => { try { if (window.${REC_BINDING}) window.${REC_BINDING}(JSON.stringify(o)) } catch (e) {} }
  const roleOf = (el) => {
    const r = el.getAttribute('role'); if (r) return r
    const t = el.tagName.toLowerCase(), ty = (el.getAttribute('type') || '').toLowerCase()
    if (t === 'a' && el.hasAttribute('href')) return 'link'
    if (t === 'button' || (t === 'input' && (ty === 'button' || ty === 'submit' || ty === 'reset'))) return 'button'
    if (t === 'input' && ty === 'checkbox') return 'checkbox'
    if (t === 'input' && ty === 'radio') return 'radio'
    if (t === 'select') return 'combobox'
    return ''
  }
  const text = (s) => (s || '').replace(/\\s+/g, ' ').trim().slice(0, 60)
  const cssPath = (el) => {
    const parts = []
    for (let n = el, i = 0; n && n.nodeType === 1 && i < 4 && n !== document.body; n = n.parentElement, i++) {
      let s = n.tagName.toLowerCase(); const p = n.parentElement
      if (p) { const same = [...p.children].filter((c) => c.tagName === n.tagName); if (same.length > 1) s += ':nth-of-type(' + (same.indexOf(n) + 1) + ')' }
      parts.unshift(s)
    }
    return parts.join(' > ')
  }
  const describe = (el) => {
    const tid = el.getAttribute('data-testid') || el.getAttribute('data-test-id')
    if (tid) return { k: 'testid', v: tid }
    const tag = el.tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      const ph = el.getAttribute('placeholder'); if (ph) return { k: 'placeholder', v: text(ph) }
      const lab = el.labels && el.labels[0] ? text(el.labels[0].innerText) : text(el.getAttribute('aria-label')); if (lab) return { k: 'label', v: lab }
    }
    const role = roleOf(el), name = text(el.getAttribute('aria-label') || el.innerText || el.value)
    if (role && name) return { k: 'role', role: role, name: name }
    if (name && name.length < 40 && ['button', 'a', 'label', 'span', 'li', 'h1', 'h2', 'h3', 'p'].indexOf(tag) >= 0) return { k: 'text', v: name }
    if (el.id && !/\\d{4,}/.test(el.id)) return { k: 'css', v: '#' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) }
    const nm = el.getAttribute('name'); if (nm) return { k: 'css', v: tag + '[name="' + nm + '"]' }
    return { k: 'css', v: cssPath(el) }
  }
  const target = (el) => (el.closest ? el.closest('a,button,input,select,textarea,label,summary,[role=button],[role=link],[role=tab],[role=menuitem]') || el : el)
  document.addEventListener('click', (e) => {
    if (!e.isTrusted) return
    const el = target(e.target); if (!el || el.tagName === 'BODY' || el.tagName === 'HTML') return
    if (el.tagName === 'SELECT') return
    send({ t: 'click', sel: describe(el) })
  }, true)
  let timer = 0, pending = null
  const flush = () => { if (pending) { send(pending); pending = null } clearTimeout(timer) }
  document.addEventListener('input', (e) => {
    if (!e.isTrusted) return
    const el = e.target; if (!el || !el.tagName) return
    const tag = el.tagName.toLowerCase(), ty = (el.getAttribute('type') || '').toLowerCase()
    if (tag === 'select') { send({ t: 'select', sel: describe(el), value: el.value }); return }
    if ((tag === 'input' && ['checkbox', 'radio', 'button', 'submit', 'file'].indexOf(ty) < 0) || tag === 'textarea' || el.isContentEditable) {
      pending = { t: 'fill', sel: describe(el), value: ty === 'password' ? '' : (el.value !== undefined ? el.value : el.innerText), secret: ty === 'password' }
      clearTimeout(timer); timer = setTimeout(flush, 500)
    }
  }, true)
  document.addEventListener('keydown', (e) => {
    if (!e.isTrusted || ['Enter', 'Escape', 'Tab'].indexOf(e.key) < 0) return
    const el = e.target; if (!el || !el.tagName || el.tagName === 'BODY') return
    flush(); send({ t: 'press', sel: describe(el), key: e.key })
  }, true)
})()`

const q = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`
/** Konumlandirici (Playwright) */
export function locator(sel: Sel): string {
  switch (sel.k) {
    case 'testid': return `page.getByTestId(${q(sel.v)})`
    case 'placeholder': return `page.getByPlaceholder(${q(sel.v)})`
    case 'label': return `page.getByLabel(${q(sel.v)})`
    case 'text': return `page.getByText(${q(sel.v)}, { exact: true })`
    case 'role': return `page.getByRole(${q(sel.role)}, { name: ${q(sel.name)} })`
    default: return `page.locator(${q(sel.v)})`
  }
}
const same = (a: Sel, b: Sel): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Adimlari sadelestirir: ayni alana ust uste fill'leri birlestirir, fill oncesindeki tiklamayi atar */
export function tidySteps(steps: Step[]): Step[] {
  const out: Step[] = []
  for (const s of steps) {
    const last = out[out.length - 1]
    if (s.t === 'fill' && last && last.t === 'fill' && same(last.sel, s.sel)) { out[out.length - 1] = s; continue }
    if (s.t === 'fill' && last && last.t === 'click' && same(last.sel, s.sel)) { out[out.length - 1] = s; continue }
    if (s.t === 'press' && last && last.t === 'fill' && same(last.sel, s.sel) && s.key === 'Tab') continue
    out.push(s)
  }
  return out
}

/** Playwright Test dosyasi uretir */
export function toPlaywright(steps: Step[], title = 'recorded flow'): string {
  const lines: string[] = []
  for (const s of tidySteps(steps)) {
    switch (s.t) {
      case 'goto': lines.push(`  await page.goto(${q(s.url)});`); break
      case 'click': lines.push(`  await ${locator(s.sel)}.click();`); break
      case 'fill': lines.push(s.secret ? `  await ${locator(s.sel)}.fill(process.env.PASSWORD ?? ''); // sifre kaydedilmez` : `  await ${locator(s.sel)}.fill(${q(s.value)});`); break
      case 'select': lines.push(`  await ${locator(s.sel)}.selectOption(${q(s.value)});`); break
      case 'press': lines.push(`  await ${locator(s.sel)}.press(${q(s.key)});`); break
    }
  }
  return `import { test, expect } from '@playwright/test';\n\ntest(${q(title)}, async ({ page }) => {\n${lines.join('\n')}\n});\n`
}
