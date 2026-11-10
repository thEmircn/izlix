/** Sayfada calisan, zaman alabilen denetimler (Promise doner; ana surec awaitPromise ile bekler). */

/** Ayni kaynakli (same-origin) baglantilari HEAD (gerekirse GET) ile kontrol eder; 6 paralel, en fazla 80 baglanti. */
export const LINK_CHECK = String.raw`(async () => {
  const origin = location.origin;
  const urls = Array.from(new Set(Array.from(document.querySelectorAll('a[href]')).map((a) => a.href.split('#')[0]).filter((u) => u.indexOf(origin) === 0))).slice(0, 80);
  const out = []; let i = 0;
  const worker = async () => {
    while (i < urls.length) {
      const u = urls[i++];
      try {
        let r = await fetch(u, { method: 'HEAD', redirect: 'follow' });
        if (r.status === 405 || r.status === 501) r = await fetch(u, { redirect: 'follow' });
        out.push({ url: u, status: r.status });
      } catch (e) { out.push({ url: u, status: 0 }); }
    }
  };
  await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
  return { checked: urls.length, results: out };
})()`

/** Gorseller: dogal boyut / goruntulenen boyut, aktarilan bayt, lazy-load. */
export const IMAGE_AUDIT = String.raw`(function () {
  const perf = {}; performance.getEntriesByType('resource').forEach((e) => { if (e.initiatorType === 'img' || e.initiatorType === 'css' || /\.(png|jpe?g|gif|webp|avif|svg)/i.test(e.name)) perf[e.name] = e.encodedBodySize || e.transferSize || 0; });
  const dpr = window.devicePixelRatio || 1;
  const rows = Array.from(document.images).map((i) => {
    const r = i.getBoundingClientRect();
    const src = i.currentSrc || i.src || '';
    return { src: src.slice(0, 200), nw: i.naturalWidth, nh: i.naturalHeight, dw: Math.round(r.width), dh: Math.round(r.height), bytes: perf[src] || 0, lazy: i.loading === 'lazy', inView: r.top < innerHeight && r.bottom > 0, hasDims: !!(i.getAttribute('width') && i.getAttribute('height')), dpr: dpr };
  });
  return rows;
})()`
