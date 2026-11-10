import { describe, expect, it, vi } from 'vitest'
import { CdpProxy, FORWARDED_EVENTS, isAllowedMethod, REACT_CHAIN_FN } from './cdpproxy'

describe('cdpproxy izin listesi', () => {
  it('izinli yontemler', () => { for (const m of ['DOM.getDocument', 'CSS.getComputedStyleForNode', 'Network.deleteCookies', 'DOMStorage.clear']) expect(isAllowedMethod(m)).toBe(true) })
  it('tehlikeli yontemler reddedilir', () => {
    for (const m of ['Runtime.evaluate', 'Page.navigate', 'Fetch.enable', 'Network.enable', 'Browser.close', 'Target.createTarget', 'Debugger.enable', 'IO.read', 'Page.captureScreenshot', 'DOM.enable', 'Page.navigate']) expect(isAllowedMethod(m)).toBe(false)
  })
  it('call izinsiz yontemde reddeder ve sendCommand cagirmaz', async () => {
    const send = vi.fn()
    const p = new CdpProxy(() => ({ isDestroyed: () => false, debugger: { sendCommand: send, on() {}, removeListener() {} } }) as any, () => {})
    await expect(p.call('t', 'Runtime.evaluate', { expression: '1' })).rejects.toThrow()
    expect(send).not.toHaveBeenCalled()
    await p.call('t', 'DOM.getDocument', { depth: 1 })
    expect(send).toHaveBeenCalledWith('DOM.getDocument', { depth: 1 })
  })
  it('olay suzgeci ve enable/disable yasam dongusu', async () => {
    expect(FORWARDED_EVENTS.test('DOM.documentUpdated')).toBe(true); expect(FORWARDED_EVENTS.test('Network.requestWillBeSent')).toBe(false)
    const cmds: string[] = []; let listener: any = null; let removed = false
    const wc: any = { isDestroyed: () => false, debugger: { sendCommand: async (m: string) => { cmds.push(m) }, on: (_: string, l: any) => { listener = l }, removeListener: () => { removed = true } } }
    const events: string[] = []
    const p = new CdpProxy(() => wc, (_t, m) => events.push(m))
    await p.enable('t', 'elements'); await p.enable('t', 'elements')
    expect(cmds).toEqual(['DOM.enable', 'CSS.enable', 'Overlay.enable'])
    listener(null, 'DOM.documentUpdated', {}); listener(null, 'Network.requestWillBeSent', {})
    expect(events).toEqual(['DOM.documentUpdated'])
    await p.disable('t', 'elements')
    expect(cmds.slice(3)).toContain('DOM.disable'); expect(removed).toBe(true)
  })
  it('react zincir fonksiyonu gecerli JS', () => { expect(() => new Function(`return (${REACT_CHAIN_FN})`)).not.toThrow() })
})
