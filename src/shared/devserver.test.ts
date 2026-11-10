import { describe, expect, it } from 'vitest'
import { detectPackageManager, extractUrl, pickScripts, runCommand, stripAnsi } from './devserver'

describe('devserver helpers', () => {
  it('paket yoneticisi: kilit dosyasi onceligi', () => {
    expect(detectPackageManager(['pnpm-lock.yaml', 'package-lock.json'])).toBe('pnpm'); expect(detectPackageManager(['yarn.lock'])).toBe('yarn'); expect(detectPackageManager(['bun.lockb'])).toBe('bun'); expect(detectPackageManager(['package.json'])).toBe('npm')
  })
  it('script secimi: dev sunucusuna benzeyenler once; pre/post atlanir', () => {
    const s = pickScripts({ scripts: { build: 'tsc', test: 'vitest', dev: 'vite', predev: 'x', start: 'node s.js', lint: 'eslint', custom: 'next dev -p 3000' } })
    expect(s.map((x) => x.name)).toEqual(['dev', 'start', 'custom', 'build', 'lint', 'test'])
    expect(s.filter((x) => x.likely).map((x) => x.name)).toEqual(['dev', 'start', 'custom']); expect(pickScripts(null)).toEqual([])
  })
  it('komut: yonetici bicimleri; tehlikeli script adi reddedilir', () => {
    expect(runCommand('npm', 'dev')).toBe('npm run dev'); expect(runCommand('yarn', 'dev')).toBe('yarn dev'); expect(runCommand('bun', 'dev')).toBe('bun run dev'); expect(runCommand('pnpm', 'dev:web')).toBe('pnpm run dev:web')
    expect(() => runCommand('npm', 'dev; rm -rf ~')).toThrow(); expect(() => runCommand('npm', '$(x)')).toThrow()
  })
  it('url ayiklama ve ANSI temizleme', () => {
    expect(extractUrl('  ➜  Local:   http://localhost:5173/')).toBe('http://localhost:5173/')
    expect(extractUrl('ready - started server on 0.0.0.0:3000, url: http://0.0.0.0:3000')).toBe('http://localhost:3000')
    expect(extractUrl('\u001B[32mLocal:\u001B[0m http://127.0.0.1:8080/app.')).toBe('http://127.0.0.1:8080/app')
    expect(extractUrl('listening on https://example.com')).toBeNull(); expect(extractUrl('no url')).toBeNull()
    expect(stripAnsi('\u001B[1m\u001B[31mred\u001B[0m')).toBe('red')
  })
})
