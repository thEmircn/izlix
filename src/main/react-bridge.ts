// React koprusu: sayfaya Page.addScriptToEvaluateOnNewDocument ile enjekte edilir.
// Spike karari: react-devtools backend yerine hafif kendi hook'umuz (commit + degisen props/hooks yeterli).
// Sayfa -> ana surec yolu: Runtime.addBinding('__izlix_emit') (IPC kanali yok).
export const BINDING = '__izlix_emit'

export const BRIDGE_SOURCE = String.raw`(() => {
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || window.__IZLIX_BRIDGE__) return;
  window.__IZLIX_BRIDGE__ = true;
  const wall = () => performance.timeOrigin + performance.now();
  const emit = (type, data) => {
    try { window.${BINDING}(JSON.stringify(Object.assign({ type: type, wall: wall() }, data))); } catch (e) {}
  };

  // ---- girdi olaylari ----
  // activeInput: girdi olayinin islendigi gorev (task) boyunca dolu. React 18/19 ayrik olaylari
  // ayni gorevin microtask'inda commit eder; bu yuzden commit'te dolu ise baglanti KESIN'dir.
  let inputSeq = 0, activeInput = null;
  ['click', 'input', 'keydown', 'submit', 'change'].forEach((name) => {
    addEventListener(name, (ev) => {
      const t = ev.target;
      const el = t && t.tagName ? (t.tagName.toLowerCase() + (t.id ? '#' + t.id : '')) : '';
      const id = ++inputSeq;
      activeInput = id;
      setTimeout(() => { if (activeInput === id) activeInput = null; }, 0);
      emit('input', { inputId: id, name: name, target: el, text: (t && t.textContent || '').slice(0, 40) });
    }, true);
  });

  // ---- fetch: yanit islendi mi (yanit -> render baglantisi icin) ----
  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || String(input);
      const method = (init && init.method) || (input && input.method) || 'GET';
      emit('fetch-start', { url: new URL(url, location.href).href, method: method, inputId: activeInput });
      return origFetch.apply(this, arguments);
    };
  }

  // ---- XHR (axios vb.): fetch ile ayni girdi baglantisi ----
  const XHR = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
  if (XHR) {
    const origOpen = XHR.open, origSend = XHR.send;
    XHR.open = function (method, url) { this.__dbUrl = url; this.__dbMethod = method; return origOpen.apply(this, arguments); };
    XHR.send = function () {
      try { emit('fetch-start', { url: new URL(String(this.__dbUrl), location.href).href, method: this.__dbMethod, inputId: activeInput }); } catch (e) {}
      return origSend.apply(this, arguments);
    };
  }

  // ---- fiber yardimcilari ----
  const FUNCTION = 0, CLASS = 1, FORWARD_REF = 11, MEMO = 14, SIMPLE_MEMO = 15;
  const COMPONENT_TAGS = [FUNCTION, CLASS, FORWARD_REF, MEMO, SIMPLE_MEMO];
  const PERFORMED_WORK = 1;

  function nameOf(f) {
    const t = f.type;
    if (!t) return 'Unknown';
    if (typeof t === 'function') return t.displayName || t.name || 'Anonymous';
    if (t.displayName) return t.displayName;
    if (t.render) return t.render.displayName || t.render.name || 'ForwardRef';
    if (t.type) return t.type.displayName || t.type.name || 'Memo';
    return 'Unknown';
  }

  function changedKeys(a, b) {
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return [];
    const out = [];
    const keys = new Set(Object.keys(a).concat(Object.keys(b)));
    keys.forEach((k) => { if (k !== 'children' && !Object.is(a[k], b[k])) out.push(k); });
    return out;
  }

  // Fonksiyon bilesenlerinde hook zinciri: memoizedState bagli liste
  function changedHooks(f, prev) {
    const out = [];
    let c = f.memoizedState, p = prev.memoizedState, i = 0;
    while (c && p && typeof c === 'object' && 'next' in c) {
      if (!Object.is(c.memoizedState, p.memoizedState)) out.push({ index: i, stateful: !!c.queue });
      c = c.next; p = p.next; i++;
    }
    return out;
  }

  const typeIds = new Map(), typeList = [];
  window.__IZLIX_TYPE__ = (id) => typeList[id];
  function typeIdOf(f) {
    let fn = f.type;
    if (fn && typeof fn !== 'function') fn = fn.render || fn.type;
    if (fn && typeof fn !== 'function') fn = fn.render || fn.type; // memo(forwardRef(...))
    if (typeof fn !== 'function') return undefined;
    let id = typeIds.get(fn);
    if (id === undefined) { id = typeList.length; typeList.push(fn); typeIds.set(fn, id); }
    return id;
  }

  function describe(f) {
    const prev = f.alternate;
    if (!prev) return { name: nameOf(f), reason: 'mount', t: typeIdOf(f) };
    const props = changedKeys(f.memoizedProps, prev.memoizedProps);
    let hooks = [], state = false;
    if (f.tag === CLASS) { state = !Object.is(f.memoizedState, prev.memoizedState); }
    else { hooks = changedHooks(f, prev); }
    let reason = 'parent';
    if (props.length) reason = 'props';
    if (hooks.length || state) reason = props.length ? 'props+state' : 'state';
    const d = { name: nameOf(f), reason: reason, t: typeIdOf(f) };
    if (props.length) d.props = props;
    if (hooks.length) d.hooks = hooks;
    if (typeof f.actualDuration === 'number') d.ms = Math.round(f.actualDuration * 100) / 100;
    return d;
  }

  function collect(root) {
    const rendered = [];
    let total = 0;
    (function walk(f) {
      while (f) {
        total++;
        if (COMPONENT_TAGS.indexOf(f.tag) !== -1 && (f.flags & PERFORMED_WORK)) {
          rendered.push(describe(f));
        }
        // alt agac yeniden uzlastirilmadiysa (child ayni) altina inme
        if (f.alternate && f.child === f.alternate.child) { f = f.sibling; continue; }
        walk(f.child);
        f = f.sibling;
      }
    })(root.current.child);
    return { rendered: rendered, total: total };
  }

  let rid = 0, commitSeq = 0;
  const renderers = new Map();
  const hook = {
    supportsFiber: true,
    renderers: renderers,
    inject(renderer) { const id = ++rid; renderers.set(id, renderer); emit('inject', { version: renderer.version, bundleType: renderer.bundleType }); return id; },
    onCommitFiberRoot(id, root) {
      const t0 = performance.now();
      let info;
      try { info = collect(root); } catch (e) { emit('bridge-error', { message: String(e) }); return; }
      const dur = root.current && root.current.actualDuration;
      emit('commit', {
        commitId: ++commitSeq, renderer: id, inputId: activeInput, count: info.rendered.length, total: info.total,
        ms: typeof dur === 'number' ? Math.round(dur * 100) / 100 : undefined,
        bridgeMs: Math.round((performance.now() - t0) * 100) / 100,
        components: info.rendered.slice(0, 200)
      });
    },
    onPostCommitFiberRoot() {}, onCommitFiberUnmount() {}, checkDCE() {}, onScheduleFiberRoot() {}
  };
  Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', { value: hook, configurable: true });
})();`
