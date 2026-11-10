/** Sayfadaki tum stil kurallari ve seciciyle eslesen oge var mi (anlik). Sozde sinif/oge ayriklari seciciden cikarilarak taban secici denenir. */
export const CSS_SNAPSHOT = String.raw`(function () {
  const out = [];
  const strip = (s) => s.replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, '');
  function walk(rules, url) {
    for (const r of rules) {
      if (r.type === 1) {
        let used = false;
        for (const s of r.selectorText.split(',')) {
          const b = strip(s).trim();
          if (!b) { used = true; break; }
          try { if (document.querySelector(b)) { used = true; break; } } catch (e) { used = true; break; }
        }
        out.push({ sel: r.selectorText.replace(/\s+/g, ' ').slice(0, 140), used: used, url: url });
      } else if (r.cssRules && (r.type === 4 || r.type === 12 || r.type === 3)) walk(r.cssRules, url);
    }
  }
  for (const sh of document.styleSheets) { try { walk(sh.cssRules, sh.href || 'inline'); } catch (e) {} }
  return out;
})()`
