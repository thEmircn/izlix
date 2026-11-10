/** Sayfanin meta/SEO verisi (anlik). Sonuc JSON'dur; degerlendirme shared/seo.ts'de. */
export const SEO_SCRIPT = String.raw`(function () {
  const meta = (n) => { const e = document.querySelector('meta[name="' + n + '"],meta[property="' + n + '"]'); return e ? e.getAttribute('content') || '' : null; };
  const og = {}, tw = {};
  document.querySelectorAll('meta[property^="og:"]').forEach((e) => { og[e.getAttribute('property')] = e.getAttribute('content') || ''; });
  document.querySelectorAll('meta[name^="twitter:"]').forEach((e) => { tw[e.getAttribute('name')] = e.getAttribute('content') || ''; });
  const jsonld = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => { try { const j = JSON.parse(s.textContent); (Array.isArray(j) ? j : [j]).forEach((x) => jsonld.push({ type: String((x && (x['@type'] || (x['@graph'] && 'Graph'))) || 'unknown'), ok: true })); } catch (e) { jsonld.push({ type: 'invalid JSON', ok: false }); } });
  const canon = document.querySelector('link[rel="canonical"]');
  const links = Array.from(document.querySelectorAll('a[href]'));
  const origin = location.origin;
  const imgs = Array.from(document.images);
  return {
    url: location.href, title: document.title, description: meta('description'), canonical: canon ? canon.href : null, robots: meta('robots'), viewport: meta('viewport'),
    lang: document.documentElement.lang || null, charset: document.characterSet, og: og, twitter: tw, jsonld: jsonld,
    h1: Array.from(document.querySelectorAll('h1')).map((h) => h.textContent.trim().slice(0, 100)),
    icon: !!document.querySelector('link[rel~="icon"]'),
    links: { total: links.length, internal: links.filter((a) => a.origin === origin).length, external: links.filter((a) => a.origin !== origin && /^https?:/.test(a.href)).length, nofollow: links.filter((a) => /nofollow/.test(a.rel)).length },
    images: { total: imgs.length, noAlt: imgs.filter((i) => !i.hasAttribute('alt')).length }
  };
})()`
