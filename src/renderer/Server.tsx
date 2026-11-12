import { useEffect, useRef, useState } from 'react'
import { Select } from './ui'
import { toast, useStore, useT } from './store'

interface Info { rootDir: string | null; pm: string; scripts: { name: string; cmd: string; likely: boolean }[]; status: 'idle' | 'starting' | 'running' | 'exited'; script?: string; url?: string; exitCode?: number | null; lines: string[] }

/** Server paneli: Workspace klasorundeki dev sunucusunu baslat/durdur, canli log; URL gorununce sekme acilir. */
export function Server() {
  const t = useT()
  const wsId = useStore((s) => s.activeWorkspaceId)
  const wsName = useStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.name)
  const [info, setInfo] = useState<Info | null>(null)
  const [script, setScript] = useState('')
  const [lines, setLines] = useState<string[]>([])
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  useEffect(() => {
    let live = true
    setInfo(null); setLines([])
    void window.izlix.serverInfo(wsId).then((i: Info) => { if (!live) return; setInfo(i); setLines(i.lines); setScript(i.script ?? i.scripts.find((x) => x.likely)?.name ?? i.scripts[0]?.name ?? '') })
    const off = window.izlix.onServer((e: any) => {
      if (e.wsId !== wsId) return
      setLines((l) => [...l, ...e.lines].slice(-1500))
      setInfo((i) => (i ? { ...i, status: e.status, url: e.url ?? i.url, script: e.script ?? i.script, exitCode: e.exitCode } : i))
    })
    return () => { live = false; off() }
  }, [wsId])
  useEffect(() => { const el = box.current; if (el && stick.current) el.scrollTop = el.scrollHeight }, [lines.length])

  if (!info) return <div className="skeleton" style={{ height: 60, margin: 12 }} />
  if (!info.rootDir) return <div className="empty-hint">{t('srv.noRoot')}</div>
  if (!info.scripts.length) return <div className="empty-hint">{t('srv.noScripts', { d: info.rootDir })}</div>
  const running = info.status === 'starting' || info.status === 'running'
  const shown = q ? lines.filter((l) => l.toLowerCase().includes(q.toLowerCase())) : lines
  return (
    <div className="srv">
      <div className="net-bar">
        <span className={`srvstat ${info.status}`}><i className="vdot" />{t(`srv.${info.status}` as any)}{info.url ? ` · ${info.url.replace(/^https?:\/\//, '')}` : ''}</span>
        <span style={{ flex: 1 }} />
        <Select value={script} disabled={running} onChange={(e) => setScript(e.target.value)}>
          {info.scripts.map((s) => <option key={s.name} value={s.name}>{info.pm} run {s.name}</option>)}
        </Select>
        {running
          ? <button className="btn" onClick={() => void window.izlix.serverStop(wsId)}>{t('srv.stop')}</button>
          : <button className="btn primary" onClick={() => { setLines([]); void window.izlix.serverStart(wsId, script).then((ok: boolean) => { if (!ok) toast(t('srv.failed')) }) }}>{t('srv.start')}</button>}
        {info.url && <button className="btn" onClick={() => void window.izlix.createTab(info.url)}>{t('srv.open')}</button>}
      </div>
      <div className="net-bar" style={{ paddingTop: 0 }}><span className="origin" title={info.rootDir}>{wsName} · {info.rootDir}</span><span style={{ flex: 1 }} /><input className="search" style={{ maxWidth: 200 }} placeholder={t('con.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={() => { void navigator.clipboard?.writeText(lines.join('\n')); toast(t('toast.copied')) }}>{t('rr.copy')}</button><button className="btn" onClick={() => setLines([])}>{t('net.clear')}</button></div>
      <div className="srv-log" ref={box} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40 }}>
        {shown.map((l, i) => <div key={i} className={/error|failed|ERR!|✘/i.test(l) ? 'e' : /warn/i.test(l) ? 'w' : l.startsWith('$ ') || l.startsWith('[') ? 'sys' : ''}>{l}</div>)}
        {!shown.length && <div className="empty-hint">{t('srv.empty')}</div>}
      </div>
    </div>
  )
}
