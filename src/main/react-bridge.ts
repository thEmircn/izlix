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

  // hassas mod: tools/izlix-source donusumu bilesene __izlix_src ("dosya:satir:sutun") ekler
  function srcOf(f) {
    const t = f.type, e = f.elementType;
    if (!t) return undefined;
    const c = [t, t.type, t.render, t.type && t.type.render, e, e && e.type, e && e.render];
    for (let i = 0; i < c.length; i++) { if (c[i] && typeof c[i].__izlix_src === 'string') return c[i].__izlix_src; }
    return undefined;
  }
  const srcSent = new Set();
  function describe(f) {
    const prev = f.alternate;
    if (!prev) { const m = { name: nameOf(f), reason: 'mount', t: typeIdOf(f) }; if (m.t !== undefined && !srcSent.has(m.t)) { const sp = srcOf(f); if (sp) { m.src = sp; srcSent.add(m.t); } } return m; }
    const props = changedKeys(f.memoizedProps, prev.memoizedProps);
    let hooks = [], state = false;
    if (f.tag === CLASS) { state = !Object.is(f.memoizedState, prev.memoizedState); }
    else { hooks = changedHooks(f, prev); }
    let reason = 'parent';
    if (props.length) reason = 'props';
    if (hooks.length || state) reason = props.length ? 'props+state' : 'state';
    const d = { name: nameOf(f), reason: reason, t: typeIdOf(f) };
    if (d.t !== undefined && !srcSent.has(d.t)) { const sp = srcOf(f); if (sp) { d.src = sp; srcSent.add(d.t); } }
    if (props.length) d.props = props;
    if (hooks.length) d.hooks = hooks;
    if (typeof f.actualDuration === 'number') d.ms = Math.round(f.actualDuration * 100) / 100;
    return d;
  }

  // ---- "Yeniden render'lari vurgula" (opt-in): render olan bilesenlerin DOM kutusu kisa sure parlar ----
  let flash = false, layer = null;
  function hostOf(f) { let c = f, g = 0; while (c && g++ < 60) { if (c.tag === 5 && c.stateNode && c.stateNode.getBoundingClientRect) return c.stateNode; c = c.child; } return null; }
  window.__IZLIX_FLASH__ = function (on) { flash = !!on; if (!flash && layer) { layer.remove(); layer = null; } return flash; };
  const FLASH_COLOR = { mount: '#34d399', state: '#fbbf24', 'props+state': '#fbbf24', props: '#f4f4f5', parent: '#71717a' };
  function paint(hosts) {
    if (!layer || !layer.isConnected) {
      layer = document.createElement('div'); layer.id = '__izlix_flash__';
      layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
      (document.body || document.documentElement).appendChild(layer);
    }
    const seen = new Set();
    hosts.forEach((h) => {
      if (seen.has(h.el)) return; seen.add(h.el);
      const r = h.el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) return;
      const b = document.createElement('div'); const c = FLASH_COLOR[h.reason] || '#71717a';
      b.style.cssText = 'position:fixed;box-sizing:border-box;border:2px solid ' + c + ';background:' + c + '22;border-radius:3px;transition:opacity .7s ease-out;opacity:1;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;';
      layer.appendChild(b);
      requestAnimationFrame(() => { requestAnimationFrame(() => { b.style.opacity = '0'; }); });
      setTimeout(() => b.remove(), 800);
    });
  }

  function collect(root) {
    const rendered = [], hosts = [];
    let total = 0;
    (function walk(f) {
      while (f) {
        total++;
        if (COMPONENT_TAGS.indexOf(f.tag) !== -1 && (f.flags & PERFORMED_WORK)) {
          const d = describe(f); rendered.push(d);
          if (flash && hosts.length < 150) { const h = hostOf(f); if (h) hosts.push({ el: h, reason: d.reason }); }
        }
        // alt agac yeniden uzlastirilmadiysa (child ayni) altina inme
        if (f.alternate && f.child === f.alternate.child) { f = f.sibling; continue; }
        walk(f.child);
        f = f.sibling;
      }
    })(root.current.child);
    return { rendered: rendered, total: total, hosts: hosts };
  }

  // ---- React Inspector: agac ve ayrinti TALEP UZERINE hesaplanir (ana surec Runtime.evaluate ile cagirir; ek yuk yok) ----
  const rootsByRenderer = new Map();
  let inspected = [];
  function ser(v, depth, seen) {
    try {
      if (v === null || v === undefined) return v === null ? null : { $: 'undefined' };
      const t = typeof v;
      if (t === 'string') return v.length > 200 ? v.slice(0, 200) + '…' : v;
      if (t === 'number') return Number.isFinite(v) ? v : { $: String(v) };
      if (t === 'boolean') return v;
      if (t === 'bigint') return { $: v + 'n' };
      if (t === 'symbol') return { $: String(v) };
      if (t === 'function') return { $: 'ƒ ' + (v.displayName || v.name || 'anonymous') + '()' };
      if (v.$$typeof) return { $: '<' + (typeof v.type === 'string' ? v.type : (v.type && (v.type.displayName || v.type.name)) || 'Element') + ' />' };
      if (typeof Node !== 'undefined' && v instanceof Node) return { $: '<' + String(v.nodeName).toLowerCase() + '>' };
      if (seen.indexOf(v) !== -1) return { $: '[Circular]' };
      if (depth >= 3) return { $: Array.isArray(v) ? 'Array(' + v.length + ')' : '{…}' };
      seen = seen.concat([v]);
      if (Array.isArray(v)) return v.slice(0, 20).map((x) => ser(x, depth + 1, seen)).concat(v.length > 20 ? [{ $: '…' + (v.length - 20) + ' more' }] : []);
      if (v instanceof Map) return { $: 'Map(' + v.size + ')' };
      if (v instanceof Set) return { $: 'Set(' + v.size + ')' };
      if (v instanceof Date) return { $: v.toISOString() };
      const out = {}; const keys = Object.keys(v);
      keys.slice(0, 20).forEach((k) => { out[k] = ser(v[k], depth + 1, seen); });
      if (keys.length > 20) out['…'] = { $: (keys.length - 20) + ' more' };
      return out;
    } catch (e) { return { $: '[unreadable]' }; }
  }
  window.__IZLIX_TREE__ = function () {
    const out = []; inspected = [];
    const LIMIT = 20000;
    function walk(f, depth) {
      while (f && out.length < LIMIT) {
        if (COMPONENT_TAGS.indexOf(f.tag) !== -1) {
          out.push({ id: inspected.length, depth: depth, name: nameOf(f), t: typeIdOf(f), key: f.key == null ? undefined : String(f.key) });
          inspected.push(f);
          walk(f.child, depth + 1);
        } else walk(f.child, depth);
        f = f.sibling;
      }
    }
    rootsByRenderer.forEach((root) => walk(root.current && root.current.child, 0));
    return { nodes: out, truncated: out.length >= LIMIT };
  };
  window.__IZLIX_INSPECT__ = function (id) {
    const f = inspected[id];
    if (!f) return null;
    const d = { name: nameOf(f), src: srcOf(f), props: ser(f.memoizedProps, 0, []), ms: typeof f.actualDuration === 'number' ? Math.round(f.actualDuration * 100) / 100 : undefined };
    if (f.tag === CLASS) d.state = ser(f.memoizedState, 0, []);
    else {
      const hooks = []; let c = f.memoizedState, i = 0;
      while (c && typeof c === 'object' && 'next' in c && i < 60) {
        const m = c.memoizedState;
        let kind = 'hook';
        if (c.queue) kind = 'state';
        else if (m && typeof m === 'object' && !Array.isArray(m) && 'create' in m && 'deps' in m) kind = 'effect';
        else if (m && typeof m === 'object' && !Array.isArray(m) && Object.keys(m).length === 1 && 'current' in m) kind = 'ref';
        else if (Array.isArray(m) && m.length === 2 && (Array.isArray(m[1]) || m[1] === null)) kind = 'memo';
        hooks.push({ index: i, kind: kind, value: kind === 'effect' ? { $: 'effect' } : ser(kind === 'memo' ? m[0] : m, 0, []) });
        c = c.next; i++;
      }
      d.hooks = hooks;
    }
    return d;
  };

  let rid = 0, commitSeq = 0;
  const renderers = new Map();
  const hook = {
    supportsFiber: true,
    renderers: renderers,
    inject(renderer) { const id = ++rid; renderers.set(id, renderer); emit('inject', { version: renderer.version, bundleType: renderer.bundleType }); return id; },
    onCommitFiberRoot(id, root) {
      rootsByRenderer.set(id, root);
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
      if (flash && info.hosts.length) { try { paint(info.hosts); } catch (e) {} }
    },
    onPostCommitFiberRoot() {}, onCommitFiberUnmount() {}, checkDCE() {}, onScheduleFiberRoot() {}
  };
  Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', { value: hook, configurable: true });
})();`
