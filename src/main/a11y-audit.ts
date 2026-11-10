/** Sayfada calistirilan erisilebilirlik denetimi (WCAG 2.2'den secilmis, hizli ve guvenilir kurallar). Sonuc: { issues, stats }. */
export const A11Y_AUDIT = String.raw`(function () {
  const issues = []; const MAX = 200;
  const sel = (el) => {
    if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
    const parts = []; let e = el;
    while (e && e.nodeType === 1 && e !== document.documentElement && parts.length < 6) { let i = 1, s = e; while ((s = s.previousElementSibling)) if (s.tagName === e.tagName) i++; parts.unshift(e.tagName.toLowerCase() + (i > 1 ? ':nth-of-type(' + i + ')' : '')); e = e.parentElement; }
    return parts.join(' > ');
  };
  const add = (rule, sev, el, detail, wcag) => { if (issues.length < MAX) issues.push({ rule: rule, sev: sev, selector: sel(el), html: el.outerHTML.slice(0, 140), detail: detail, wcag: wcag }); };
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const name = (el) => {
    const aria = el.getAttribute('aria-label'); if (aria && aria.trim()) return aria;
    const lb = el.getAttribute('aria-labelledby');
    if (lb) { const t = lb.split(/\s+/).map((i) => { const n = document.getElementById(i); return n ? n.textContent : ''; }).join(' ').trim(); if (t) return t; }
    if (el.labels && el.labels.length) { const t = Array.from(el.labels).map((l) => l.textContent).join(' ').trim(); if (t) return t; }
    const t = (el.textContent || '').trim(); if (t) return t;
    const img = el.querySelector('img[alt]'); if (img && img.alt.trim()) return img.alt;
    const title = el.getAttribute('title'); if (title && title.trim()) return title;
    if (el.tagName === 'INPUT' && /button|submit|reset/.test(el.type) && el.value) return el.value;
    return '';
  };
  document.querySelectorAll('img').forEach((i) => { if (!i.hasAttribute('alt') && i.getAttribute('role') !== 'presentation') add('img-alt', 'error', i, 'Image has no alt attribute', '1.1.1'); });
  document.querySelectorAll('button,[role=button],a[href],[role=link]').forEach((e) => { if (visible(e) && !name(e)) add(e.tagName === 'A' ? 'link-name' : 'button-name', 'error', e, 'Has no accessible name', '4.1.2'); });
  document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]),select,textarea').forEach((e) => { if (visible(e) && !name(e)) add('label', 'error', e, 'Form control has no label', '1.3.1'); });
  if (!document.documentElement.lang) add('html-lang', 'error', document.documentElement, '<html> has no lang attribute', '3.1.1');
  if (!document.title.trim()) add('document-title', 'error', document.documentElement, 'Page has no <title>', '2.4.2');
  if (!document.querySelector('main,[role=main]')) add('landmark-main', 'warn', document.body, 'No <main> landmark', '1.3.1');
  let prev = 0; document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => { const l = +h.tagName[1]; if (prev && l > prev + 1) add('heading-order', 'warn', h, 'Heading level jumps from h' + prev + ' to h' + l, '1.3.1'); prev = l; });
  if (!document.querySelector('h1')) add('page-h1', 'warn', document.body, 'No <h1> heading', '1.3.1');
  const seen = {}; document.querySelectorAll('[id]').forEach((e) => { if (seen[e.id]) add('duplicate-id', 'error', e, 'Duplicate id "' + e.id + '"', '4.1.1'); seen[e.id] = 1; });
  document.querySelectorAll('[tabindex]').forEach((e) => { if (+e.getAttribute('tabindex') > 0) add('tabindex', 'warn', e, 'Positive tabindex disrupts focus order', '2.4.3'); });
  document.querySelectorAll('button,a[href],input[type=checkbox],input[type=radio],[role=button]').forEach((e) => { if (!visible(e)) return; const r = e.getBoundingClientRect(); if (r.width < 24 || r.height < 24) add('target-size', 'warn', e, 'Click target is ' + Math.round(r.width) + '×' + Math.round(r.height) + 'px (min 24×24)', '2.5.8'); });
  // responsive / yerlesim kurallari
  if (!document.querySelector('meta[name=viewport]')) add('viewport-meta', 'warn', document.head || document.documentElement, 'No <meta name="viewport">: mobile layout will be a zoomed-out desktop page', 'responsive');
  document.querySelectorAll('img').forEach((i) => { if (visible(i) && (!i.getAttribute('width') || !i.getAttribute('height')) && !/\d/.test(i.style.width + i.style.height)) add('img-size', 'warn', i, 'Image has no width/height attributes (layout shift risk)', 'cls'); });
  let over = 0; const vw = document.documentElement.clientWidth;
  document.querySelectorAll('body *').forEach((e) => { if (over >= 15) return; const r = e.getBoundingClientRect(); if (r.width > 0 && r.right > vw + 1 && getComputedStyle(e).position !== 'fixed') { const p = e.parentElement; if (p && p.getBoundingClientRect().right > vw + 1 && p !== document.body) return; over++; add('overflow-x', 'warn', e, 'Extends ' + Math.round(r.right - vw) + 'px beyond the viewport (horizontal scroll)', 'responsive'); } });
  const lum = (c) => { const a = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { c: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 }; };
  const bgOf = (el) => { let e = el; while (e) { const b = parse(getComputedStyle(e).backgroundColor); if (b && b.a > 0.5) return b.c; e = e.parentElement; } return [255, 255, 255]; };
  let checked = 0; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const done = new Set(); let n;
  while ((n = w.nextNode()) && checked < 400) {
    const t = n.nodeValue.trim(); if (!t) continue; const el = n.parentElement; if (!el || done.has(el) || !visible(el)) continue; done.add(el); checked++;
    const cs = getComputedStyle(el); const fg = parse(cs.color); if (!fg) continue; const bg = bgOf(el);
    const L1 = lum(fg.c), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700; const large = size >= 24 || (size >= 18.66 && bold); const need = large ? 3 : 4.5;
    if (ratio < need) add('color-contrast', 'error', el, 'Contrast ' + ratio.toFixed(2) + ':1 (needs ' + need + ':1)', '1.4.3');
  }
  return { issues: issues, stats: { checkedText: checked } };
})()`
