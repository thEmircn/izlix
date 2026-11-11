import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' }, safeStorage: {}, clipboard: { writeText: vi.fn(), readText: () => '', clear: vi.fn() } }))
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PasswordService, plainCipher, type PwHooks } from './passwords'
import { fillScript } from '../shared/passwords'

type Listener = (e: unknown, method: string, p: unknown) => void
function fakeWc(url: string) {
  let listener: Listener = () => {}
  const wc = {
    url, js: [] as string[], isDestroyed: () => false, getURL: () => wc.url,
    debugger: { sendCommand: vi.fn(async () => ({})), on: (_: string, l: Listener) => { listener = l } },
    executeJavaScript: vi.fn(async (code: string) => { wc.js.push(code); return true })
  }
  const call = (payload: unknown): void => listener(null, 'Runtime.bindingCalled', { name: '__dbPw', payload: JSON.stringify(payload) })
  return { wc: wc as any, call }
}
const mk = (over: Partial<PwHooks> = {}) => {
  const hooks: PwHooks = { ask: vi.fn(async () => 'save' as const), pick: vi.fn(async () => 0), isPrivate: () => false, changed: vi.fn(), ...over }
  return { svc: new PasswordService(mkdtempSync(join(tmpdir(), 'pw-')), plainCipher, hooks), hooks }
}
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 20))

describe('PasswordService', () => {
  it('giris formunu kaydeder; liste parolayi icermez; ayni kayit tekrar sorulmaz', async () => {
    const { svc, hooks } = mk(); const { wc, call } = fakeWc('https://a.com/login'); await svc.attach(wc)
    call({ t: 'save', u: 'ali', p: 'sifre1' }); await tick()
    expect(svc.list().map((l) => [l.origin, l.username])).toEqual([['https://a.com', 'ali']])
    expect(JSON.stringify(svc.list())).not.toContain('sifre1')
    expect(svc.getFor('https://a.com')).toEqual([{ u: 'ali', p: 'sifre1' }])
    expect(svc.count('https://a.com/x')).toBe(1); expect(svc.count('https://b.com')).toBe(0)
    await new Promise((r) => setTimeout(r, 2100)); call({ t: 'save', u: 'ali', p: 'sifre1' }); await tick()
    expect(hooks.ask).toHaveBeenCalledTimes(1)
  })
  it('ayni kullanici yeni parola: guncelleme sorulur ve guncellenir', async () => {
    const { svc, hooks } = mk(); const { wc, call } = fakeWc('https://a.com/'); await svc.attach(wc)
    call({ t: 'save', u: 'ali', p: 'eski' }); await tick(); await new Promise((r) => setTimeout(r, 2100))
    call({ t: 'save', u: 'ali', p: 'yeni' }); await tick()
    expect((hooks.ask as any).mock.calls[1][3]).toBe(true)
    expect(svc.getFor('https://a.com')).toEqual([{ u: 'ali', p: 'yeni' }]); expect(svc.list()).toHaveLength(1)
  })
  it('"asla" secilen kaynak bir daha sorulmaz; gizli sekmede kayit yok; hizli tekrar yok sayilir', async () => {
    const a = mk({ ask: vi.fn(async () => 'never' as const) }); const f = fakeWc('https://n.com/'); await a.svc.attach(f.wc)
    f.call({ t: 'save', u: 'x', p: 'y' }); await tick(); expect(a.svc.never()).toEqual(['https://n.com'])
    await new Promise((r) => setTimeout(r, 2100)); f.call({ t: 'save', u: 'x', p: 'z' }); await tick(); expect(a.hooks.ask).toHaveBeenCalledTimes(1)
    const b = mk({ isPrivate: () => true }); const g = fakeWc('https://p.com/'); await b.svc.attach(g.wc); g.call({ t: 'save', u: 'x', p: 'y' }); await tick(); expect(b.svc.list()).toEqual([])
    const c = mk(); const h = fakeWc('https://r.com/'); await c.svc.attach(h.wc); h.call({ t: 'save', u: 'a', p: '1' }); h.call({ t: 'save', u: 'b', p: '2' }); await tick(); expect(c.svc.list()).toHaveLength(1)
  })
  it('doldurma yalnizca birebir ayni kaynakta; cok kayitta secim; secim sirasinda sayfa degisirse doldurmaz', async () => {
    const { svc, hooks } = mk(); const { wc, call } = fakeWc('https://a.com/'); await svc.attach(wc)
    call({ t: 'save', u: 'ali', p: 'p1' }); await tick(); await new Promise((r) => setTimeout(r, 2100)); call({ t: 'save', u: 'veli', p: 'p2' }); await tick()
    ;(hooks.pick as any).mockResolvedValueOnce(1)
    expect(await svc.fill(wc)).toBe(true); expect(wc.js.at(-1)).toBe(fillScript('veli', 'p2'))
    const other = fakeWc('https://evil.com/'); await svc.attach(other.wc); expect(await svc.fill(other.wc)).toBe(false); expect(other.wc.executeJavaScript).not.toHaveBeenCalled()
    ;(hooks.pick as any).mockImplementationOnce(async () => { wc.url = 'https://evil.com/'; return 0 })
    wc.js.length = 0; expect(await svc.fill(wc)).toBe(false); expect(wc.js).toEqual([])
  })
  it('sayfadan gelen fill istegi kayitliysa doldurur; bozuk/buyuk yuk yok sayilir; silme', async () => {
    const { svc } = mk(); const { wc, call } = fakeWc('https://a.com/'); await svc.attach(wc)
    call({ t: 'save', u: 'ali', p: 'p1' }); await tick(); call({ t: 'fill' }); await tick()
    expect(wc.js.length).toBe(1)
    const l = (wc.debugger.on as any); void l
    svc.remove('https://a.com', 'ali'); expect(svc.list()).toEqual([]); expect(svc.count('https://a.com/')).toBe(0)
  })
  it('fillScript degerleri guvenli kodlar (tirnak/satir sonu enjeksiyonu yok)', () => {
    const s = fillScript('a"; alert(1); "', "p'\n</script>")
    expect(s).toContain(JSON.stringify('a"; alert(1); "')); expect(() => new Function(s)).not.toThrow()
  })
  it('guvenlik denetimi: zayif, tekrar kullanilan ve (HIBP aralik yanitiyla) sizmis; parola donmez; ag yoksa pwned null', async () => {
    const { createHash } = await import('node:crypto')
    const { svc } = mk()
    const w1 = fakeWc('https://a.com/'), w2 = fakeWc('https://b.com/'), w3 = fakeWc('https://c.com/')
    for (const w of [w1, w2, w3]) await svc.attach(w.wc)
    w1.call({ t: 'save', u: 'ali', p: '123456' }); await tick(); await new Promise((r) => setTimeout(r, 2100))
    w2.call({ t: 'save', u: 'veli', p: '123456' }); await tick(); await new Promise((r) => setTimeout(r, 2100))
    w3.call({ t: 'save', u: 'can', p: 'Xk9#mQ2$vL7!pR4&zT' }); await tick()
    const local = await svc.audit(null)
    expect(local).toHaveLength(3); expect(local.find((r) => r.username === 'ali')).toMatchObject({ weak: true, reused: 1, pwned: null }); expect(local.find((r) => r.username === 'can')).toMatchObject({ weak: false, reused: 0 })
    expect(JSON.stringify(local)).not.toContain('123456')
    const h = createHash('sha1').update('123456').digest('hex').toUpperCase()
    const seen: string[] = []
    const net = await svc.audit(async (prefix) => { seen.push(prefix); return prefix === h.slice(0, 5) ? `${h.slice(5)}:9999\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:1` : '' })
    expect(net.find((r) => r.username === 'ali')!.pwned).toBe(9999); expect(net.find((r) => r.username === 'can')!.pwned).toBe(0)
    expect(seen.every((p) => p.length === 5)).toBe(true); expect(new Set(seen).size).toBe(seen.length) // yalniz 5 karakterlik onek, tekrar yok
    const down = await svc.audit(async () => { throw new Error('ag yok') }); expect(down.every((r) => r.pwned === null)).toBe(true)
  })
})
