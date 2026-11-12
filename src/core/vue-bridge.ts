/**
 * Vue 3 adaptoru: Vue'nun devtools kancasini (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) taklit eder; bilesen eklendi/guncellendi
 * olaylarini ayni "commit" mesajina cevirir. Girdi/fetch yakalama React koprusuyle ortaktir (window.__IZLIX_BRIDGE__).
 * Yalniz Vue'nun gelistirme derlemesinde veya prod devtools bayragiyla olay uretir (Vue kendi kuralidir).
 */
export const VUE_SOURCE = String.raw`(() => {
  const B = window.__IZLIX_BRIDGE__;
  if (!B || !B.emit || window.__VUE_DEVTOOLS_GLOBAL_HOOK__ || window.__IZLIX_VUE__) return;
  window.__IZLIX_VUE__ = true;
  let commitSeq = 0, scheduled = false;
  const pending = new Map();
  const nameOf = (c) => { const t = c && c.type; return (t && (t.name || t.__name || t.displayName)) || 'Anonymous'; };
  const flush = () => {
    scheduled = false;
    const comps = [...pending.values()]; pending.clear();
    if (!comps.length) return;
    B.emit('commit', { commitId: ++commitSeq, renderer: 'vue', inputId: B.input(), count: comps.length, total: comps.length, components: comps.slice(0, 200) });
  };
  const note = (c, reason) => {
    if (!c) return;
    const key = c.uid != null ? c.uid : nameOf(c);
    const prev = pending.get(key);
    pending.set(key, { name: nameOf(c), reason: prev && prev.reason === 'mount' ? 'mount' : reason });
    if (!scheduled) { scheduled = true; queueMicrotask(flush); }
  };
  const hook = {
    enabled: false, apps: [], events: new Map(),
    emit(event) {
      const args = Array.prototype.slice.call(arguments, 1);
      if (event === 'app:init') { this.apps.push(args[0]); B.emit('inject', { version: args[1], bundleType: 'vue' }); }
      else if (event === 'component:added') note(args[3], 'mount');
      else if (event === 'component:updated') note(args[3], 'update');
      const hs = this.events.get(event); if (hs) hs.forEach((h) => { try { h.apply(null, args); } catch (e) {} });
    },
    on(event, h) { const s = this.events.get(event) || new Set(); s.add(h); this.events.set(event, s); },
    once(event, h) { const w = (...a) => { this.off(event, w); h(...a); }; this.on(event, w); },
    off(event, h) { const s = this.events.get(event); if (s) s.delete(h); },
    cleanupBuffer() { return true; }
  };
  Object.defineProperty(window, '__VUE_DEVTOOLS_GLOBAL_HOOK__', { value: hook, configurable: true });
})();`
