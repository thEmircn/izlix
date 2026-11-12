import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { attrMap, keyOf, selectorOf, type DomNode } from '../shared/dom'
import { cssRule, parseInline, px, rgbToHex, stringifyInline, toTailwind, type Props } from '../shared/stylelab'
import { Select } from './ui'
import { toast, useStore, useT } from './store'

type Dt = (m: string, p?: Record<string, unknown>) => Promise<any>
const SHADOWS: [string, string][] = [['none', 'none'], ['0 1px 2px rgba(0,0,0,.2)', 'sm'], ['0 4px 6px rgba(0,0,0,.25)', 'md'], ['0 10px 15px rgba(0,0,0,.3)', 'lg']]

/** Style Lab: secili ogeyi gorsel kontrollerle canli duzenle; degisiklikleri CSS veya Tailwind olarak koda tasi. */
export function StyleLab({ nodeId, dt, node, root, tabId }: { nodeId: number; dt: Dt; node: DomNode; root: DomNode; tabId: string }) {
  const t = useT()
  const editor = useStore((s) => s.editor)
  const [computed, setComputed] = useState<Props>({})
  const [changes, setChanges] = useState<Props>({})
  const base = useRef<string>(attrMap(node).style ?? '')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nodeIdRef = useRef(nodeId); nodeIdRef.current = nodeId
  const key = keyOf(node)
  const selector = useMemo(() => selectorOf(root, nodeId), [root, nodeId])

  useEffect(() => {
    let live = true
    base.current = attrMap(node).style ?? ''; setChanges({}); setComputed({})
    void dt('CSS.getComputedStyleForNode', { nodeId }).then((d) => { if (live) setComputed(Object.fromEntries((d?.computedStyle ?? []).map((x: any) => [x.name, x.value]))) })
    return () => { live = false; if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const write = useCallback((next: Props) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void dt('DOM.setAttributeValue', { nodeId: nodeIdRef.current, name: 'style', value: stringifyInline({ ...parseInline(base.current), ...next }) }) }, 50)
  }, [dt])
  const set = (prop: string, value: string): void => {
    setChanges((c) => {
      const n = { ...c }
      if (value === '' || value === computed[prop]) delete n[prop]; else n[prop] = value
      write(n); return n
    })
  }
  const revert = (prop: string): void => set(prop, '')
  const reset = (): void => { setChanges({}); void dt('DOM.setAttributeValue', { nodeId: nodeIdRef.current, name: 'style', value: base.current }) }
  const val = (prop: string): string => changes[prop] ?? computed[prop] ?? ''
  const num = (prop: string): string => { const n = px(val(prop)); return n == null ? '' : String(Math.round(n * 100) / 100) }

  const css = cssRule(selector, changes)
  const tw = toTailwind(changes)
  const twText = tw.classes.join(' ')
  const copy = (text: string): void => { void navigator.clipboard?.writeText(text); toast(t('toast.copied')) }
  const openSource = async (): Promise<void> => {
    const chain = (await window.izlix.dtReact(tabId, nodeId)) as { file?: string; line?: number }[] | null
    const c = chain?.find((x) => x.file && x.line)
    if (c) void window.izlix.openSource({ file: c.file!, line: c.line!, editor }); else toast(t('el.noReact'))
  }

  const N = ({ p, label, unit = 'px', w = 54 }: { p: string; label?: string; unit?: string; w?: number }) => (
    <label className="lab-n" title={p}>{label && <span>{label}</span>}
      <input type="number" step="1" value={num(p)} style={{ width: w }} onChange={(e) => set(p, e.target.value === '' ? '' : `${e.target.value}${unit}`)} /></label>
  )
  const Sl = ({ p, label, min, max, step = 1, unit = 'px' }: { p: string; label: string; min: number; max: number; step?: number; unit?: string }) => (
    <label className="lab-sl"><span>{label}</span><input type="range" min={min} max={max} step={step} value={Number(num(p)) || 0} onChange={(e) => set(p, `${e.target.value}${unit}`)} /><code>{num(p) || 0}{unit}</code></label>
  )
  const Sel = ({ p, label, opts }: { p: string; label: string; opts: string[] }) => (
    <label className="lab-s"><span>{label}</span><Select value={opts.includes(val(p)) ? val(p) : ''} onChange={(e) => set(p, e.target.value)}><option value="">{val(p) || '—'}</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</Select></label>
  )
  const Col = ({ p, label }: { p: string; label: string }) => (
    <label className="lab-c"><span>{label}</span><input type="color" value={rgbToHex(val(p))} onChange={(e) => set(p, e.target.value)} /><code>{rgbToHex(val(p))}</code></label>
  )
  const Pill = ({ p, opts }: { p: string; opts: [string, string][] }) => (
    <span className="lab-pill">{opts.map(([v, l]) => <button key={v} className={val(p) === v ? 'on' : ''} onClick={() => set(p, v)}>{l}</button>)}</span>
  )

  const changed = Object.entries(changes)
  return (
    <div className="lab">
      <section className="lab-sec">
        <h5>{t('lab.spacing')}</h5>
        <div className="lab-box">
          <div className="lb-m"><span className="lb-t">margin</span>
            <div className="lb-row"><N p="margin-top" w={44} /></div>
            <div className="lb-row lb-mid"><N p="margin-left" w={44} />
              <div className="lb-p"><span className="lb-t">padding</span>
                <div className="lb-row"><N p="padding-top" w={44} /></div>
                <div className="lb-row lb-mid"><N p="padding-left" w={44} /><div className="lb-c">{num('width') || '—'} × {num('height') || '—'}</div><N p="padding-right" w={44} /></div>
                <div className="lb-row"><N p="padding-bottom" w={44} /></div>
              </div>
              <N p="margin-right" w={44} /></div>
            <div className="lb-row"><N p="margin-bottom" w={44} /></div>
          </div>
        </div>
        <div className="lab-line"><N p="width" label={t('lab.width')} w={64} /><N p="height" label={t('lab.height')} w={64} /><N p="gap" label="gap" w={54} /></div>
      </section>

      <section className="lab-sec">
        <h5>{t('lab.layout')}</h5>
        <div className="lab-line"><Sel p="display" label="display" opts={['block', 'flex', 'grid', 'inline', 'inline-block', 'inline-flex', 'none']} /></div>
        <div className="lab-line"><span className="lab-l">flex-direction</span><Pill p="flex-direction" opts={[['row', '→'], ['column', '↓'], ['row-reverse', '←'], ['column-reverse', '↑']]} /></div>
        <div className="lab-line"><Sel p="justify-content" label="justify" opts={['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']} /><Sel p="align-items" label="align" opts={['flex-start', 'center', 'flex-end', 'stretch', 'baseline']} /></div>
      </section>

      <section className="lab-sec">
        <h5>{t('lab.type')}</h5>
        <Sl p="font-size" label="size" min={8} max={72} />
        <div className="lab-line"><Sel p="font-weight" label="weight" opts={['100', '200', '300', '400', '500', '600', '700', '800', '900']} /><N p="line-height" label="line" w={58} /><N p="letter-spacing" label="track" w={58} /></div>
        <div className="lab-line"><Col p="color" label={t('lab.color')} /><Pill p="text-align" opts={[['left', 'L'], ['center', 'C'], ['right', 'R'], ['justify', 'J']]} /></div>
      </section>

      <section className="lab-sec">
        <h5>{t('lab.look')}</h5>
        <div className="lab-line"><Col p="background-color" label={t('lab.bg')} /></div>
        <Sl p="border-radius" label="radius" min={0} max={48} />
        <label className="lab-sl"><span>opacity</span><input type="range" min={0} max={1} step={0.05} value={Number(val('opacity') || 1)} onChange={(e) => set('opacity', e.target.value)} /><code>{val('opacity') || 1}</code></label>
        <div className="lab-line"><span className="lab-l">shadow</span><span className="lab-pill">{SHADOWS.map(([v, l]) => <button key={l} className={val('box-shadow') === v ? 'on' : ''} onClick={() => set('box-shadow', v)}>{l}</button>)}</span></div>
      </section>

      <section className="lab-sec lab-out">
        <h5>{t('lab.changes')} <span className="mdim">{changed.length}</span> {changed.length > 0 && <button className="btn sm" onClick={reset}>{t('lab.reset')}</button>}</h5>
        {changed.length === 0 && <div className="tsub">{t('lab.none')}</div>}
        <div className="lab-chips">{changed.map(([k, v]) => <button key={k} className="rchip ac" title={`${computed[k] ?? ''} → ${v}`} onClick={() => revert(k)}>{k}: {v} ×</button>)}</div>
        {changed.length > 0 && <>
          <div className="lab-code"><div className="mlabel">CSS</div><pre>{css}</pre><button className="btn sm" onClick={() => copy(css)}>{t('lab.copy')}</button></div>
          <div className="lab-code"><div className="mlabel">Tailwind</div><pre>{twText || '—'}</pre>{Object.keys(tw.unmapped).length > 0 && <small>{t('lab.unmapped')}: {Object.entries(tw.unmapped).map(([k, v]) => `${k}: ${v}`).join('; ')}</small>}<button className="btn sm" disabled={!twText} onClick={() => copy(twText)}>{t('lab.copy')}</button></div>
        </>}
        <button className="btn" onClick={() => void openSource()}>{t('lab.openSrc')}</button>
      </section>
    </div>
  )
}
