import { createServer, type Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import type { AddressInfo } from 'node:net'

export interface FocusStrings { title: string; focusMsg: string; limitMsg: string; allow5: string; allow30: string; off: string; back: string }
type Act = { kind: 'allow'; site: string; minutes: number } | { kind: 'off' }
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Odak/limit engel sayfasi: yalniz 127.0.0.1; her dugme TEK KULLANIMLIK rastgele jetonla calisir (baska siteler tetikleyemez). */
export class FocusServer {
  private server: Server | null = null
  private port = 0
  private pages = new Map<string, string>()
  private acts = new Map<string, { act: Act; target: string; exp: number }>()
  constructor(private onAction: (a: Act) => void) {}

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      const m = /^\/(b|a)\/([a-f0-9]{16,})$/.exec(req.url ?? '')
      if (!m) { res.writeHead(404); res.end(); return }
      if (m[1] === 'b') { const html = this.pages.get(m[2]); if (!html) { res.writeHead(404); res.end(); return } res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY' }); res.end(html); return }
      const a = this.acts.get(m[2]); this.acts.delete(m[2]) // tek kullanim
      if (!a || a.exp < Date.now()) { res.writeHead(410); res.end('expired'); return }
      this.onAction(a.act); res.writeHead(302, { location: a.target }); res.end()
    })
    await new Promise<void>((r) => this.server!.listen(0, '127.0.0.1', r))
    this.port = (this.server.address() as AddressInfo).port
    this.server.unref()
  }
  get ready(): boolean { return this.port > 0 }

  /** Engel sayfasinin adresi (hedef URL'ye izin verilince yonlendirir) */
  urlFor(o: { site: string; reason: 'focus' | 'limit'; limitMin?: number; target: string; s: FocusStrings }): string {
    const tok = (act: Act): string => { const t = randomBytes(12).toString('hex'); this.acts.set(t, { act, target: o.target, exp: Date.now() + 30 * 60_000 }); if (this.acts.size > 200) this.acts.delete(this.acts.keys().next().value!); return t }
    const msg = (o.reason === 'focus' ? o.s.focusMsg : o.s.limitMsg).replace('{site}', o.site).replace('{n}', String(o.limitMin ?? ''))
    const btn = (label: string, t: string, cls = ''): string => `<a class="b ${cls}" href="/a/${t}">${esc(label)}</a>`
    const html = `<!doctype html><meta charset="utf-8"><title>${esc(o.s.title)}</title><style>
html,body{height:100%;margin:0;background:#0f1013;color:#e9e9ec;font:15px -apple-system,system-ui,sans-serif}
main{height:100%;display:grid;place-content:center;text-align:center;gap:14px;padding:24px}
h1{font-size:22px;margin:0;font-weight:600}p{margin:0;color:#9a9ba3;max-width:440px;line-height:1.5}
.row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:10px}.b{padding:9px 16px;border-radius:10px;background:#1d1f25;border:1px solid #2c2f38;color:#e9e9ec;text-decoration:none}.b:hover{background:#262932}.p{background:#ff6a2b;border-color:#ff6a2b;color:#111}
.ic{width:46px;height:46px;border-radius:50%;margin:0 auto;border:2px solid #ff6a2b;display:grid;place-items:center;color:#ff6a2b;font-size:22px}</style>
<main><div class="ic">◐</div><h1>${esc(o.s.title)}</h1><p>${esc(msg)}</p><div class="row">${btn(o.s.allow5, tok({ kind: 'allow', site: o.site, minutes: 5 }))}${btn(o.s.allow30, tok({ kind: 'allow', site: o.site, minutes: 30 }))}${o.reason === 'focus' ? btn(o.s.off, tok({ kind: 'off' }), 'p') : ''}<a class="b" href="javascript:history.back()">${esc(o.s.back)}</a></div></main>`
    const id = randomBytes(12).toString('hex'); this.pages.set(id, html); if (this.pages.size > 100) this.pages.delete(this.pages.keys().next().value!)
    return `http://127.0.0.1:${this.port}/b/${id}`
  }
}
