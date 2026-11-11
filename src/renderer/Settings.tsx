import { ENGINES } from '../shared/search'
import { generatePassword } from '../shared/pwgen'
import { parseLimits, siteList } from '../shared/usage'
import { BUDGET_KEYS, DEFAULT_BUDGET, unitOf } from '../shared/budgets'
import { useEffect, useState } from 'react'
import type { DevToolsDock, Editor, Language } from '../shared/events'
import { useStore, useT, writePref, toast } from './store'
import { Kbd } from './ui'

function Switch({ on, onChange, label }: { on: boolean; onChange(v: boolean): void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}><i /></button>
}

/** Ayarlar (⌘,): dil, editor, telemetri, otomatik sekme, DevTools yerlesimi. */
const syncErrKey = (e: string): 'set.syncErr.no-pass' | 'set.syncErr.no-icloud' | 'set.syncErr.bad-pass' | 'set.syncErr.corrupt' | 'set.syncErr.error' => (e === 'no-pass' || e === 'no-icloud' || e === 'bad-pass' || e === 'corrupt' ? (`set.syncErr.${e}` as const) : 'set.syncErr.error')

export function Settings({ onClose }: { onClose(): void }) {
  const t = useT()
  const settings = useStore((s) => s.settings)
  const editor = useStore((s) => s.editor)
  const dock = useStore((s) => s.dock)
  const tabLayout = useStore((s) => s.tabLayout)
  const set = useStore((s) => s.set)
  const api = window.izlix
  const [perms, setPerms] = useState<{ origin: string; permission: string; decision: string }[]>([])
  const [pw, setPw] = useState<{ logins: { origin: string; username: string; ts: number }[]; never: string[] }>({ logins: [], never: [] })
  const [scText, setScText] = useState((settings.shortcuts ?? []).map((x) => `${x.key} ${x.url}`).join('\n'))
  const saveShortcuts = (): void => { const list = scText.split('\n').map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 2).map(([key, url]) => ({ key, url })); void api.setSettings({ shortcuts: list }).then(() => toast(t('site.saved'))) }
  const [gen, setGen] = useState(() => generatePassword({ length: 20 }))
  const [genLen, setGenLen] = useState(20)
  const [audit, setAudit] = useState<{ origin: string; username: string; weak: boolean; reused: number; pwned: number | null }[] | null>(null)
  const focus = settings.focus ?? { on: false, sites: [], limits: {} }
  const [fSites, setFSites] = useState(focus.sites.join('\n'))
  const [fLimits, setFLimits] = useState(Object.entries(focus.limits).map(([k, v]) => `${k} ${v}`).join('\n'))
  const saveFocus = (on = focus.on): void => { void api.setSettings({ focus: { ...focus, on, sites: siteList(fSites), limits: parseLimits(fLimits) } }) }
  const aiCfg = settings.ai ?? { provider: 'ollama' as const, model: 'llama3.1' }
  const [aiKey, setAiKey] = useState('')
  const [aiHas, setAiHas] = useState<Record<string, boolean>>({})
  useEffect(() => { void api.aiPreview().then((p: { provider: string; hasKey: boolean }) => setAiHas((h) => ({ ...h, [p.provider]: p.hasKey }))) }, [aiCfg.provider])
  const loadPw = (): void => { void api.pwList().then((l: any) => setPw(l ?? { logins: [], never: [] })) }
  useEffect(loadPw, [])
  const [sy, setSy] = useState<{ enabled: boolean; hasPass: boolean; last: number; error: string; dir: string; icloud: boolean } | null>(null); const [syPass, setSyPass] = useState(''); const [syBusy, setSyBusy] = useState(false)
  const loadSy = (): void => { void api.syncState().then(setSy) }
  useEffect(loadSy, [])
  const [drm, setDrm] = useState<'check' | 'yes' | 'no'>('check')
  useEffect(() => { void navigator.requestMediaKeySystemAccess('com.widevine.alpha', [{ initDataTypes: ['cenc'], videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }] }]).then(() => setDrm('yes'), () => setDrm('no')) }, [])
  const [exts, setExts] = useState<{ id: string; name: string; version: string; path: string }[]>([]); const [extErr, setExtErr] = useState('')
  const loadExts = (): void => { void api.extList().then(setExts) }
  useEffect(loadExts, [])
  const loadPerms = (): void => { void api.permList().then((l: any) => setPerms(l ?? [])) }
  useEffect(loadPerms, [])
  const Row = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
    <div className="srow"><div><div className="stitle">{title}</div>{hint && <div className="shint">{hint}</div>}</div><div>{children}</div></div>
  )
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-label={t('set.title')} style={{ width: 'min(560px, 92vw)' }} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center' }}><b style={{ flex: 1, fontSize: 14 }}>{t('set.title')}</b><Kbd>⌘,</Kbd></div>
        <div style={{ overflow: 'auto', padding: '4px 18px 14px' }}>
          <Row title={t('set.language')}>
            <select value={settings.language} onChange={(e) => void api.setSettings({ language: e.target.value as Language })}><option value="en">English</option><option value="tr">Türkçe</option></select>
          </Row>
          <Row title={t('set.search')} hint={t('set.searchHint')}>
            <select value={settings.searchEngine ?? 'duckduckgo'} onChange={(e) => void api.setSettings({ searchEngine: e.target.value })}>{ENGINES.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select>
          </Row>
          <Row title={t('set.adblock')} hint={t('set.adblockHint')}>
            <select value={settings.adblock ?? 'ads'} onChange={(e) => void api.setSettings({ adblock: e.target.value })}><option value="off">{t('ad.lvl.off')}</option><option value="ads">{t('ad.lvl.ads')}</option><option value="strict">{t('ad.lvl.strict')}</option></select>
          </Row>
          <Row title={t('set.import')} hint={t('set.importHint')}>
            <button className="btn" onClick={() => void api.importChrome().then((r: { bookmarks: number; history: number } | null) => toast(r ? t('imp.done', { b: r.bookmarks, h: r.history }) : t('imp.none')))}>{t('set.importBtn')}</button>
          </Row>
          <Row title={t('set.safari')} hint={t('set.safariHint')}>
            <button className="btn" onClick={() => void api.importSafari().then((r: any) => toast(r === 'denied' ? t('imp.denied') : r ? t('imp.done', { b: r.bookmarks, h: r.history }) : t('imp.none')))}>{t('set.importBtn')}</button>
          </Row>
          <Row title={t('set.default')} hint={t('set.defaultHint')}>
            <button className="btn" onClick={() => void api.defaultBrowser(true).then((ok: boolean) => toast(t(ok ? 'def.ok' : 'def.ask')))}>{t('set.defaultBtn')}</button>
          </Row>
          <Row title={t('set.sleep')} hint={t('set.sleepHint')}>
            <select value={settings.sleepMinutes ?? 30} onChange={(e) => void api.setSettings({ sleepMinutes: Number(e.target.value) })}>{[0, 10, 30, 60, 180].map((m) => <option key={m} value={m}>{m === 0 ? t('ad.lvl.off') : t('set.sleepMin', { n: m })}</option>)}</select>
          </Row>
          <Row title={t('set.strip')} hint={t('set.stripHint')}><Switch on={settings.stripTracking !== false} label={t('set.strip')} onChange={(v) => void api.setSettings({ stripTracking: v })} /></Row>
          <Row title={t('set.consent')} hint={t('set.consentHint')}><Switch on={settings.cookieBanners !== false} label={t('set.consent')} onChange={(v) => void api.setSettings({ cookieBanners: v })} /></Row>
          <div className="srow" style={{ display: 'block' }}>
            <div className="stitle">{t('pw.title')}</div><div className="shint" style={{ marginBottom: 6 }}>{t('pw.hint')}</div>
            {pw.logins.length === 0 && <div className="shint">{t('pw.none')}</div>}
            {pw.logins.map((l) => (
              <div className="pwrow" key={l.origin + l.username}><div className="pwo"><b>{l.username || t('pw.noUser')}</b><small>{l.origin}</small></div>
                <button className="btn" onClick={() => void api.pwCopy(l.origin, l.username).then(() => toast(t('pw.copied')))}>{t('pw.copy')}</button>
                <button className="btn" onClick={() => void api.pwDelete(l.origin, l.username).then(loadPw)}>{t('pw.del')}</button></div>
            ))}
            <div className="pwrow"><div className="pwo"><b style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5 }}>{gen}</b><small>{t('pw.gen')}</small></div>
              <input type="range" min={8} max={48} value={genLen} onChange={(e) => { const n = Number(e.target.value); setGenLen(n); setGen(generatePassword({ length: n })) }} style={{ width: 90 }} aria-label={t('pw.length')} />
              <button className="btn" onClick={() => setGen(generatePassword({ length: genLen }))}>{t('pw.regen')}</button>
              <button className="btn" onClick={() => void navigator.clipboard.writeText(gen).then(() => toast(t('qr.copied')))}>{t('pw.copyGen')}</button></div>
            <div className="pwrow"><div className="pwo"><b>{t('pw.audit')}</b><small>{t('pw.auditHint')}</small></div>
              <button className="btn" onClick={() => void api.pwAudit(false).then(setAudit)}>{t('pw.auditLocal')}</button>
              <button className="btn" onClick={() => void api.pwAudit(true).then(setAudit)}>{t('pw.auditBreach')}</button></div>
            {audit && (audit.length === 0 ? <div className="shint">{t('pw.none')}</div> : audit.map((a) => (
              <div className="pwrow" key={a.origin + a.username}><div className="pwo"><b>{a.username || t('pw.noUser')}</b><small>{a.origin}</small></div>
                {a.pwned ? <span className="chip" style={{ color: 'var(--bad, #ff6b6b)' }}>{t('pw.pwned', { n: a.pwned })}</span> : a.pwned === 0 ? <span className="chip" style={{ color: 'var(--ok, #6ee7a8)' }}>{t('pw.notPwned')}</span> : null}
                {a.weak && <span className="chip" style={{ color: 'var(--warn, #f5b94a)' }}>{t('pw.weak')}</span>}
                {a.reused > 0 && <span className="chip" style={{ color: 'var(--warn, #f5b94a)' }}>{t('pw.reused', { n: a.reused })}</span>}
                {!a.weak && !a.reused && !a.pwned && <span className="chip" style={{ color: 'var(--ok, #6ee7a8)' }}>{t('pw.ok')}</span>}</div>
            )))}
            {pw.never.map((o) => <div className="pwrow" key={o}><div className="pwo"><b>{o}</b><small>{t('pw.neverNote')}</small></div><button className="btn" onClick={() => void api.pwNeverRemove(o).then(loadPw)}>{t('pw.del')}</button></div>)}
          </div>
          <div className="srow" style={{ display: 'block' }} data-testid="drm-row"><div className="stitle">{t('set.drm')}</div><div className="shint" data-testid="drm-status">{drm === 'check' ? '…' : drm === 'yes' ? t('set.drmYes') : t('set.drmNo')}</div></div>
          <div className="srow" style={{ display: 'block' }} data-testid="sync-section">
            <div className="stitle">{t('set.sync')}</div><div className="shint" style={{ marginBottom: 6 }}>{t('set.syncHint')}</div>
            {sy && !sy.icloud && <div className="shint" style={{ color: 'var(--warn, #f5b94a)' }}>{t('set.syncNoIcloud')}</div>}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '6px 0' }}>
              <input type="password" value={syPass} placeholder={sy?.hasPass ? t('set.syncPassSet') : t('set.syncPass')} onChange={(e) => setSyPass(e.target.value)} style={{ flex: 1 }} />
              <button className="btn" disabled={syPass.length < 8} onClick={() => void api.syncSetup({ pass: syPass }).then(() => { setSyPass(''); loadSy() })}>{t('set.syncSave')}</button>
            </div>
            {syPass.length > 0 && syPass.length < 8 && <div className="shint">{t('set.syncShort')}</div>}
            <Row title={t('set.syncAuto')} hint={t('set.syncAutoHint')}><Switch on={!!sy?.enabled} label={t('set.syncAuto')} onChange={(v) => void api.syncSetup({ enabled: v }).then(loadSy)} /></Row>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn" disabled={!sy?.hasPass || syBusy} onClick={() => { setSyBusy(true); void api.syncNow().then(() => { setSyBusy(false); loadSy() }) }}>{t('set.syncNow')}</button>
              <span className="shint">{sy?.error ? t(syncErrKey(sy.error)) : sy?.last ? t('set.syncLast', { t: new Date(sy.last).toLocaleString() }) : t('set.syncNever')}</span>
            </div>
            <div className="shint" style={{ marginTop: 6 }}>{t('set.syncNote')}</div>
          </div>
          <div className="srow" style={{ display: 'block' }}>
            <div className="stitle">{t('set.ext')}</div><div className="shint" style={{ marginBottom: 6 }}>{t('set.extHint')}</div>
            {exts.length === 0 && <div className="shint">{t('set.extNone')}</div>}
            {exts.map((x) => <div className="pwrow" key={x.id}><div className="pwo"><b>{x.name}</b><small>{x.version} · {x.path}</small></div><button className="btn" onClick={() => void api.extRemove(x.path).then(loadExts)}>{t('set.extRemove')}</button></div>)}
            <button className="btn" data-testid="ext-add" onClick={() => void api.extAdd().then((r) => { setExtErr(r.ok ? '' : r.error ?? ''); loadExts() })}>{t('set.extAdd')}</button>
            {extErr && <div className="shint" style={{ color: 'var(--bad, #ff6b6b)' }}>{t('set.extErr', { e: extErr })}</div>}
          </div>
          <Row title={t('set.spell')} hint={t('set.spellHint')}><Switch on={settings.spellcheck !== false} label={t('set.spell')} onChange={(v) => void api.setSettings({ spellcheck: v })} /></Row>
          <Row title={t('set.https')} hint={t('set.httpsHint')}><Switch on={settings.httpsOnly !== false} label={t('set.https')} onChange={(v) => void api.setSettings({ httpsOnly: v })} /></Row>
          <div className="srow" style={{ display: 'block' }}>
            <div className="stitle">{t('set.shortcuts')}</div><div className="shint" style={{ marginBottom: 6 }}>{t('set.shortcutsHint')}</div>
            <textarea value={scText} spellCheck={false} rows={4} placeholder="docs https://docs.example.com/search?q=%s" style={{ width: '100%', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }} onChange={(e) => setScText(e.target.value)} onBlur={saveShortcuts} />
          </div>
          <div className="srow" style={{ display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}><div style={{ flex: 1 }}><div className="stitle">{t('set.focus')}</div><div className="shint">{t('set.focusHint')}</div></div><Switch on={focus.on} label={t('set.focus')} onChange={(v) => saveFocus(v)} /></div>
            <div className="shint" style={{ margin: '8px 0 4px' }}>{t('set.focusSites')}</div>
            <textarea value={fSites} spellCheck={false} rows={3} placeholder="youtube.com&#10;twitter.com" style={{ width: '100%', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }} onChange={(e) => setFSites(e.target.value)} onBlur={() => saveFocus()} />
            <div className="shint" style={{ margin: '8px 0 4px' }}>{t('set.focusLimits')}</div>
            <textarea value={fLimits} spellCheck={false} rows={2} placeholder="reddit.com 30" style={{ width: '100%', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }} onChange={(e) => setFLimits(e.target.value)} onBlur={() => saveFocus()} />
            <div style={{ marginTop: 8 }}><button className="btn" onClick={() => set({ overlay: 'usage' })}>{t('usage.open')}</button></div>
          </div>
          <div className="srow" style={{ display: 'block' }}>
            <div className="stitle">{t('budget.title')}</div><div className="shint" style={{ marginBottom: 6 }}>{t('budget.hint')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {BUDGET_KEYS.map((k) => (
                <label key={k} className="bin"><span>{t(`budget.${k}` as any)}{unitOf(k)}</span>
                  <input type="number" min={0} step={k === 'cls' ? 0.01 : 1} defaultValue={(settings.budgets as Record<string, number> | undefined)?.[k] ?? (DEFAULT_BUDGET as Record<string, number>)[k] ?? ''} placeholder="—"
                    onBlur={(e) => { const v = Number(e.target.value); const next: Record<string, number> = { ...(settings.budgets ?? {}) }; if (v > 0) next[k] = v; else delete next[k]; void api.setSettings({ budgets: next }) }} /></label>
              ))}
            </div>
          </div>
          <div className="srow" style={{ display: 'block' }}>
            <div className="stitle">{t('set.ai')}</div><div className="shint" style={{ marginBottom: 6 }}>{t('set.aiHint')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8, alignItems: 'center' }}>
              <select value={aiCfg.provider} onChange={(e) => { const p = e.target.value as 'ollama' | 'anthropic' | 'openai'; void api.setSettings({ ai: { provider: p, model: { ollama: 'llama3.1', anthropic: 'claude-sonnet-5-5', openai: 'gpt-4o-mini' }[p] } }) }}><option value="ollama">Ollama (local)</option><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option></select>
              <input defaultValue={aiCfg.model} key={aiCfg.provider} placeholder={t('set.aiModel')} onBlur={(e) => { if (e.target.value.trim()) void api.setSettings({ ai: { ...aiCfg, model: e.target.value.trim() } }) }} />
              {aiCfg.provider === 'ollama' ? <><span className="shint">{t('set.aiEndpoint')}</span><input defaultValue={aiCfg.endpoint ?? ''} placeholder="http://127.0.0.1:11434" onBlur={(e) => void api.setSettings({ ai: { ...aiCfg, endpoint: e.target.value.trim() || undefined } })} /></>
                : <><span className="shint">{t('set.aiKey')}</span><div style={{ display: 'flex', gap: 6 }}><input type="password" value={aiKey} placeholder={aiHas[aiCfg.provider] ? t('set.aiKeySaved') : 'sk-…'} onChange={(e) => setAiKey(e.target.value)} style={{ flex: 1 }} /><button className="btn" onClick={() => void api.aiKey(aiCfg.provider, aiKey).then((r: { hasKey: boolean }) => { setAiHas({ ...aiHas, [aiCfg.provider]: r.hasKey }); setAiKey(''); toast(t('site.saved')) })}>{t('site.save')}</button></div></>}
            </div>
          </div>
          <Row title={t('set.ambient')} hint={t('set.ambientHint')}><Switch on={settings.ambient !== false} label={t('set.ambient')} onChange={(v) => void api.setSettings({ ambient: v })} /></Row>
          <Row title={t('set.suggest')} hint={t('set.suggestHint')}><Switch on={settings.searchSuggest !== false} label={t('set.suggest')} onChange={(v) => void api.setSettings({ searchSuggest: v })} /></Row>
          <Row title={t('set.tabLayout')} hint={t('set.tabLayoutHint')}>
            <select value={tabLayout} onChange={(e) => { writePref('tabLayout', e.target.value); set({ tabLayout: e.target.value as 'top' | 'side' }) }}><option value="top">{t('tabl.top')}</option><option value="side">{t('tabl.side')}</option></select>
          </Row>
          <Row title={t('set.editor')} hint={t('set.editorHint')}>
            <select value={editor} onChange={(e) => { writePref('editor', e.target.value); set({ editor: e.target.value as Editor }) }}><option value="vscode">VS Code</option><option value="cursor">Cursor</option><option value="webstorm">WebStorm</option></select>
          </Row>
          <Row title={t('set.dock')} hint={t('set.dockHint')}>
            <select value={dock} onChange={(e) => { writePref('dock', e.target.value); set({ dock: e.target.value as DevToolsDock }) }}><option value="off">{t('dock.off')}</option><option value="right">{t('dock.right')}</option><option value="bottom">{t('dock.bottom')}</option></select>
          </Row>
          <Row title={t('set.autoOpen')} hint={t('set.autoOpenHint')}><Switch on={settings.autoOpen} label={t('set.autoOpen')} onChange={(v) => void api.setSettings({ autoOpen: v })} /></Row>
          <Row title={t('set.telemetry')} hint={t('set.telemetryHint')}><Switch on={settings.telemetry === 'granted'} label={t('set.telemetry')} onChange={(v) => void api.setSettings({ telemetry: v ? 'granted' : 'denied' })} /></Row>
          <div className="srow" style={{ display: 'block' }}>
            <div className="stitle" style={{ marginBottom: 6 }}>{t('set.perms')}</div>
            {perms.map((p) => (
              <div key={p.origin + p.permission} className="permrow"><span>{p.origin}</span><code>{p.permission}</code><em className={p.decision}>{p.decision}</em>
                <button className="link" onClick={() => void api.permRemove(p.origin, p.permission).then(loadPerms)}>{t('set.permRevoke')}</button></div>
            ))}
            {!perms.length && <div className="shint">{t('set.permsEmpty')}</div>}
          </div>
        </div>
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}><button className="btn primary" onClick={onClose}>{t('welcome.done')}</button></div>
      </div>
    </div>
  )
}
