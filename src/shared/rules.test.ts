import { describe, expect, it } from 'vitest'
import { ruleFromRequest, evaluate, hostAllowed, matchesPattern, needsResponseStage, newRule, type Rule } from './rules'
import { fuzzyScore, rank } from './fuzzy'

const rule = (p: Partial<Rule>): Rule => newRule({ id: p.id ?? 'r', ...p })
const req = { url: 'https://api.example.com/api/users?x=1', method: 'GET' }

describe('matchesPattern', () => {
  it('jokersiz kalıp URL içinde geçmeli', () => {
    expect(matchesPattern('/api/users', req.url)).toBe(true)
    expect(matchesPattern('/api/orders', req.url)).toBe(false)
  })
  it('joker tüm URL ile eşleşir, regex karakterleri kaçırılır', () => {
    expect(matchesPattern('https://api.example.com/*', req.url)).toBe(true)
    expect(matchesPattern('*/api/users?x=*', req.url)).toBe(true)
    expect(matchesPattern('https://api.exampleXcom/*', req.url)).toBe(false)
  })
})

describe('hostAllowed', () => {
  it('tam eşleşme ve alt alan adı', () => {
    expect(hostAllowed('http://localhost:5173/x', ['localhost'])).toBe(true)
    expect(hostAllowed('https://app.example.com', ['*.example.com'])).toBe(true)
    expect(hostAllowed('https://example.com', ['*.example.com'])).toBe(true)
    expect(hostAllowed('https://evilexample.com', ['*.example.com'])).toBe(false)
  })
  it('izinli olmayan, geçersiz ve boş girdi reddedilir', () => {
    expect(hostAllowed('https://prod.example.com', ['localhost'])).toBe(false)
    expect(hostAllowed('about:blank', ['localhost'])).toBe(false)
    expect(hostAllowed('', ['localhost'])).toBe(false)
    expect(hostAllowed('http://localhost', [''])).toBe(false)
  })
})

describe('evaluate', () => {
  it('eşleşme yoksa null; devre dışı kural yok sayılır', () => {
    expect(evaluate([rule({ urlPattern: '/zzz' })], req)).toBeNull()
    expect(evaluate([rule({ enabled: false })], req)).toBeNull()
  })
  it('yöntem filtresi', () => {
    const r = rule({ method: 'POST', action: { type: 'delay', ms: 10 } })
    expect(evaluate([r], req)).toBeNull()
    expect(evaluate([r], { ...req, method: 'post' })?.delayMs).toBe(10)
    expect(evaluate([r], req, { ignoreMethod: true })?.delayMs).toBe(10)
  })
  it('mock yönlendirmeye üstün gelir ve yönlendirme kaydı düşer', () => {
    const d = evaluate([
      rule({ id: 'a', action: { type: 'redirect', to: 'http://localhost:9/' } }),
      rule({ id: 'b', action: { type: 'mock', status: 201, body: '{}', contentType: 'application/json' } })
    ], req)!
    expect(d.mock?.status).toBe(201)
    expect(d.redirectTo).toBeUndefined()
    expect(d.ruleIds).toEqual(['b'])
    expect(d.kinds).toEqual(['mock'])
  })
  it('gecikme toplanır, header birleşir, ilk durum kodu kazanır', () => {
    const d = evaluate([
      rule({ id: '1', action: { type: 'delay', ms: 100 } }),
      rule({ id: '2', action: { type: 'delay', ms: 50 } }),
      rule({ id: '3', action: { type: 'headers', set: { 'X-A': '1' }, remove: ['cookie'] } }),
      rule({ id: '4', action: { type: 'status', code: 500 } }),
      rule({ id: '5', action: { type: 'status', code: 404 } })
    ], req)!
    expect(d.delayMs).toBe(150)
    expect(d.setHeaders).toEqual({ 'X-A': '1' })
    expect(d.removeHeaders).toEqual(['cookie'])
    expect(d.status).toBe(500)
    expect(d.ruleIds).toEqual(['1', '2', '3', '4'])
  })
  it('yanıt aşaması yalnızca durum kodu kuralı varken gerekir', () => {
    expect(needsResponseStage([rule({ action: { type: 'delay', ms: 1 } })])).toBe(false)
    expect(needsResponseStage([rule({ action: { type: 'status', code: 500 } })])).toBe(true)
    expect(needsResponseStage([rule({ enabled: false, action: { type: 'status', code: 500 } })])).toBe(false)
  })
})

describe('fuzzy', () => {
  it('alt dizi ve bulanık eşleşme; eşleşmeyen null', () => {
    expect(fuzzyScore('nt', 'New Tab')).not.toBeNull()
    expect(fuzzyScore('xyz', 'New Tab')).toBeNull()
    expect(fuzzyScore('', 'anything')).toBe(0)
  })
  it('baştaki tam eşleşme bulanık eşleşmeden önce gelir', () => {
    const items = ['Toggle Timeline panel', 'Open new tab', 'Reload page']
    expect(rank(items, 'reload', (s) => s)[0]).toBe('Reload page')
    expect(rank(items, 'ont', (s) => s)).toContain('Open new tab')
  })
  it('1000 komutta sıralama 50 ms altında', () => {
    const items = Array.from({ length: 1000 }, (_, i) => `Komut numarası ${i} sekme çalışma alanı`)
    const t = performance.now()
    rank(items, 'sekme 99', (s) => s)
    expect(performance.now() - t).toBeLessThan(50)
  })
})

describe('ruleFromRequest', () => {
  it('sorgu dizesini atar, yontemi korur, kendi istegiyle eslesir', () => {
    const r = ruleFromRequest('http://localhost:5173/api/items?page=2', 'GET', 'fail')
    expect(r.urlPattern).toBe('http://localhost:5173/api/items')
    expect(r.action).toEqual({ type: 'status', code: 500 })
    expect(evaluate([r], { url: 'http://localhost:5173/api/items?page=2', method: 'GET' })?.status).toBe(500)
    expect(evaluate([r], { url: 'http://localhost:5173/api/other', method: 'GET' })).toBeNull()
    expect(ruleFromRequest('http://a.com/x', 'POST', 'mock').action.type).toBe('mock')
  })
})
