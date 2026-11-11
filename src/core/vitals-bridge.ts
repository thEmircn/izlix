import { BINDING } from './react-bridge'

/** Web Vitals ve uzun gorevler: sayfaya enjekte edilen hafif PerformanceObserver betigi (framework'ten bagimsiz). */
export const VITALS_SOURCE = String.raw`(() => {
  if (window.__DB_VITALS__) return; window.__DB_VITALS__ = true;
  const emit = (name, value, extra) => { try { window.${BINDING}(JSON.stringify(Object.assign({ type: 'vital', wall: performance.timeOrigin + performance.now(), name: name, value: value }, extra || {}))); } catch (e) {} };
  const obs = (type, cb, opts) => { try { new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe(Object.assign({ type: type, buffered: true }, opts || {})); } catch (e) {} };
  obs('paint', (e) => { if (e.name === 'first-contentful-paint') emit('FCP', e.startTime); });
  obs('largest-contentful-paint', (e) => emit('LCP', e.startTime, { el: e.element ? e.element.tagName.toLowerCase() : undefined, size: e.size }));
  let cls = 0;
  obs('layout-shift', (e) => { if (!e.hadRecentInput) { cls += e.value; emit('CLS', cls, { shift: e.value }); } });
  let worst = 0;
  obs('event', (e) => { if (e.interactionId && e.duration > worst) { worst = e.duration; emit('INP', worst, { event: e.name }); } }, { durationThreshold: 40 });
  obs('longtask', (e) => emit('longtask', e.duration, { start: e.startTime }));
  const nav = () => { const n = performance.getEntriesByType('navigation')[0]; if (n) { emit('TTFB', n.responseStart); emit('DCL', n.domContentLoadedEventEnd); if (n.loadEventEnd) emit('Load', n.loadEventEnd); } };
  if (document.readyState === 'complete') setTimeout(nav, 0); else addEventListener('load', () => setTimeout(nav, 0));
})();`
