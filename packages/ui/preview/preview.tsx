// Izlix bilesen onizlemesi: uygulamadaki GERCEK bilesenlerin tumu ornek verilerle tek sayfada. `npm run preview:components`.
// Her bilesen bir cercevede (transform ile "fixed" ogeler de cerceve icinde kalir) ve kendi hata siniri icinde cizilir.
import { createRoot } from 'react-dom/client'
import { useState, type ReactNode } from 'react'
import '../../../src/renderer/styles.css'
import '../../../src/renderer/native.css'
import './preview.css'
import { useStore } from '../../../src/renderer/store'
import { ErrorBoundary } from '../../../src/renderer/ErrorBoundary'
import type { BusEvent } from '../../../src/shared/events'
import SAMPLE from './sample-events.json'
import { App } from '../../../src/renderer/App'
import { Timeline } from '../../../src/renderer/Timeline'
import { Network } from '../../../src/renderer/Network'
import { Console } from '../../../src/renderer/Console'
import { Overview } from '../../../src/renderer/Overview'
import { Perf } from '../../../src/renderer/Perf'
import { RenderTracker, Inspector } from '../../../src/renderer/Inspector'
import { StatePanel } from '../../../src/renderer/StatePanel'
import { Elements } from '../../../src/renderer/Elements'
import { Storage } from '../../../src/renderer/Storage'
import { Sources } from '../../../src/renderer/Sources'
import { A11y } from '../../../src/renderer/A11y'
import { Coverage } from '../../../src/renderer/Coverage'
import { Profiler } from '../../../src/renderer/Profiler'
import { Seo } from '../../../src/renderer/Seo'
import { Server } from '../../../src/renderer/Server'
import { BudgetPanel } from '../../../src/renderer/BudgetChip'
import { LiveTraffic } from '../../../src/renderer/LiveTraffic'
import { RulesPanel } from '../../../src/renderer/RulesPanel'
import { Settings } from '../../../src/renderer/Settings'
import { Palette } from '../../../src/renderer/Palette'
import { Shortcuts } from '../../../src/renderer/Shortcuts'
import { Welcome } from '../../../src/renderer/Welcome'
import { StartPage } from '../../../src/renderer/StartPage'
import { HubPage } from '../../../src/renderer/HubPage'
import { HistoryPage } from '../../../src/renderer/HistoryPage'
import { DownloadsPage } from '../../../src/renderer/DownloadsPage'
import { UsagePage } from '../../../src/renderer/UsagePage'
import { NotesPage, NotePrompt } from '../../../src/renderer/Notes'
import { BookmarkManager } from '../../../src/renderer/Bookmarks'
import { SiteSettings } from '../../../src/renderer/SiteSettings'
import { AiDialog } from '../../../src/renderer/AiDialog'
import { QrDialog } from '../../../src/renderer/QrDialog'
import { TabSearch } from '../../../src/renderer/TabSearch'
import { SessionPrompt } from '../../../src/renderer/SessionPrompt'
import { RecorderDialog } from '../../../src/renderer/RecorderDialog'
import { MarkerPrompt } from '../../../src/renderer/MarkerPrompt'
import { PermissionPrompt } from '../../../src/renderer/PermissionPrompt'
import { Toasts } from '../../../src/renderer/Toasts'
import { Spark, Bars, Donut, ContextMenu, Spotlight } from '../../../src/renderer/ui'
import { Button, Chip, Dialog, Field, Segmented, Switch } from '../src'

// uygulama API'si yok: bos cevap (bilesenler bos durumlarini gosterir)
;(window as any).izlix = new Proxy({}, { get: (_t, p: string) => (...a: any[]) => (p.startsWith('on') ? () => {} : Promise.resolve(p === 'getSettings' ? { language: 'en', onboarded: true, telemetry: 'denied', theme: 'system' } : null)) })

const EV = SAMPLE as unknown as BusEvent[]
const KEY = 'tab-2'
const byId = new Map<number, BusEvent>(EV.map((e) => [e.id, e]))
useStore.setState({
  activeTabId: KEY, panelOpen: true, panelTab: 'timeline', activeWorkspaceId: 'default', overlay: null,
  settings: { ...useStore.getState().settings, language: 'en', onboarded: true } as any,
  tabs: [{ id: KEY, workspaceId: 'default', title: 'Izlix Demo', url: 'http://127.0.0.1:5173/', loading: false, canGoBack: true, canGoForward: false } as any, { id: 'tab-3', workspaceId: 'default', title: 'New Tab', url: '', loading: false, canGoBack: false, canGoForward: false } as any]
})
useStore.getState().reset(EV)

function Frame({ name, w = 560, h = 420, children }: { name: string; w?: number; h?: number; children: ReactNode }) {
  return (
    <figure className="pv-frame">
      <figcaption>{name}</figcaption>
      <div className="pv-stage" style={{ width: w, height: h }}><ErrorBoundary label={name}>{children}</ErrorBoundary></div>
    </figure>
  )
}
const noop = (): void => {}
const sec = (t: string): JSX.Element => <h2 className="pv-sec">{t}</h2>
type K = 'a' | 'b' | 'c'

function Kit() {
  const [on, setOn] = useState(true), [seg, setSeg] = useState<K>('a'), [chip, setChip] = useState(true)
  return (
    <div className="pv-kit">
      <div className="pv-row"><Button>Default</Button><Button variant="primary">Primary</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Danger</Button><Button size="sm">Small</Button><Button disabled>Disabled</Button></div>
      <div className="pv-row"><Switch on={on} onChange={setOn} label="Switch" /><Segmented items={[{ key: 'a' as K, label: 'Timeline' }, { key: 'b' as K, label: 'Network' }, { key: 'c' as K, label: 'Console' }]} value={seg} onChange={setSeg} /><Chip on={chip} count={7} onClick={() => setChip(!chip)}>Chip</Chip></div>
      <div className="pv-row"><Field label="Field" placeholder="/Users/you/app" hint="Hint text" /><Field label="Error" error="Something is wrong" defaultValue="value" /></div>
      <div className="pv-row"><select defaultValue="a"><option value="a">Select option</option><option>Other</option></select><input placeholder="Plain input" /><label><input type="checkbox" defaultChecked /> Checkbox</label><button className="btn">.btn</button><button className="btn primary">.btn primary</button><button className="btn sm">.btn sm</button><kbd>⌘K</kbd><span className="chip">.chip</span><span className="pill">.pill</span></div>
      <div className="pv-row" style={{ position: 'relative', height: 150, transform: 'translateZ(0)' }}><Dialog open onClose={noop} title="Dialog" width={360} footer={<><Button variant="ghost">Cancel</Button><Button variant="primary">OK</Button></>}><p style={{ margin: 0, color: 'var(--dim)' }}>Dialog body text.</p></Dialog></div>
    </div>
  )
}

function Page() {
  return (
    <main className="pv-page">
      <header><h1>Izlix — all components</h1><p>Real app components with sample data. Tell me which ones look bad.</p></header>
      {sec('Full window (App)')}
      <Frame name="App — whole window" w={1380} h={820}><App /></Frame>
      {sec('UI kit')}
      <Frame name="Kit: Button / Switch / Segmented / Chip / Field / Dialog / native controls" w={1100} h={430}><Kit /></Frame>
      {sec('Panels (with sample events)')}
      <div className="pv-grid">
        <Frame name="Timeline" w={640} h={520}><div style={{ position: 'relative', width: 640, height: 520 }}><Timeline width={640} height={520} /></div></Frame>
        <Frame name="Network"><Network events={EV} byId={byId} /></Frame>
        <Frame name="Console"><Console events={EV} /></Frame>
        <Frame name="Overview"><Overview events={EV} /></Frame>
        <Frame name="Render tracker"><RenderTracker events={EV} range={null} /></Frame>
        <Frame name="State"><StatePanel events={EV} /></Frame>
        <Frame name="Performance"><Perf events={EV} /></Frame>
        <Frame name="Budgets"><BudgetPanel events={EV} /></Frame>
        <Frame name="Live traffic"><div style={{ padding: 12 }}><LiveTraffic events={EV} /></div></Frame>
        <Frame name="Components (React inspector)"><Inspector height={400} /></Frame>
        <Frame name="Elements"><Elements /></Frame>
        <Frame name="Storage"><Storage /></Frame>
        <Frame name="Sources"><Sources events={EV} /></Frame>
        <Frame name="Accessibility"><A11y /></Frame>
        <Frame name="Coverage"><Coverage /></Frame>
        <Frame name="Profiler"><Profiler /></Frame>
        <Frame name="Meta / SEO"><Seo /></Frame>
        <Frame name="Server"><Server /></Frame>
        <Frame name="Request rules"><RulesPanel onClose={noop} /></Frame>
      </div>
      {sec('Pages and dialogs')}
      <div className="pv-grid">
        <Frame name="Settings" w={620} h={620}><Settings onClose={noop} /></Frame>
        <Frame name="Command palette"><Palette onClose={noop} /></Frame>
        <Frame name="Shortcuts" w={620} h={520}><Shortcuts onClose={noop} /></Frame>
        <Frame name="Welcome" w={620} h={520}><Welcome onClose={noop} /></Frame>
        <Frame name="Start page" w={760} h={520}><StartPage style={{ position: 'absolute', inset: 0 }} tabId={'tab-3'} /></Frame>
        <Frame name="Apps hub" w={760} h={520}><HubPage onClose={noop} /></Frame>
        <Frame name="History" w={620} h={480}><HistoryPage onClose={noop} /></Frame>
        <Frame name="Downloads" w={620} h={480}><DownloadsPage onClose={noop} /></Frame>
        <Frame name="Usage" w={620} h={480}><UsagePage onClose={noop} /></Frame>
        <Frame name="Notes" w={620} h={480}><NotesPage onClose={noop} /></Frame>
        <Frame name="Note prompt" h={260}><NotePrompt onClose={noop} /></Frame>
        <Frame name="Bookmarks" w={620} h={480}><BookmarkManager onClose={noop} /></Frame>
        <Frame name="Site settings" h={420}><SiteSettings tabId={KEY} onClose={noop} /></Frame>
        <Frame name="AI explain" h={360}><AiDialog onClose={noop} /></Frame>
        <Frame name="Share via QR" h={420}><QrDialog tabId={KEY} onClose={noop} /></Frame>
        <Frame name="Tab search" h={360}><TabSearch onClose={noop} /></Frame>
        <Frame name="Save session" h={260}><SessionPrompt onClose={noop} /></Frame>
        <Frame name="Recorder" h={300}><RecorderDialog onClose={noop} /></Frame>
        <Frame name="Marker" h={240}><MarkerPrompt onClose={noop} /></Frame>
        <Frame name="Permission prompt" h={240}><PermissionPrompt /></Frame>
        <Frame name="Toasts" h={200}><Toasts /></Frame>
      </div>
      {sec('Charts and small parts')}
      <div className="pv-grid">
        <Frame name="Spark" h={120}><div style={{ padding: 16 }}><Spark values={[3, 5, 4, 8, 6, 9, 5, 12, 7]} /></div></Frame>
        <Frame name="Bars" h={140}><div style={{ padding: 16 }}><Bars values={[3, 5, 4, 8, 6, 9, 5, 12, 7]} /></div></Frame>
        <Frame name="Donut" h={180}><div style={{ padding: 16 }}><Donut segments={[{ value: 5, color: 'var(--ac)', label: 'JS' }, { value: 3, color: 'var(--ok)', label: 'CSS' }, { value: 2, color: 'var(--warn)', label: 'Img' }]} /></div></Frame>
        <Frame name="Spotlight card" h={140}><div style={{ padding: 16 }}><Spotlight>Spotlight surface</Spotlight></div></Frame>
        <Frame name="Context menu" h={200}><ContextMenu x={24} y={16} onClose={noop} items={[{ label: 'Copy', onClick: noop }, { label: 'Open in editor', onClick: noop }, { label: 'Delete', onClick: noop }] as any} /></Frame>
      </div>
    </main>
  )
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary label="preview"><Page /></ErrorBoundary>)
