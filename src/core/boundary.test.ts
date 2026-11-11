import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Cekirdek katman siniri: src/core ve src/shared ayni kodu Electron kabugunda, Chrome eklentisinde ve tarayici icinde calistirmak icin
 * yalnizca web platformu API'lerini kullanabilir. Electron/Node/ana surec/arayuz bagimliligi YASAK.
 */
const ROOTS = ['src/core', 'src/shared']
const FORBIDDEN_IMPORT = /from\s+['"](electron|node:[^'"]+|fs|path|os|child_process|net|http|https|crypto|\.\.\/main\/[^'"]*|\.\.\/renderer\/[^'"]*|\.\.\/preload\/[^'"]*)['"]/
const FORBIDDEN_GLOBAL = /\b(Buffer\.|process\.(env|platform|versions|argv|cwd)|require\()/

/** Bilerek izinli: Playwright betigi URETEN sablon metinleri (calistirilmaz) */
const ALLOW = [/recorder\.ts:\d+:.*process\.env\.PASSWORD/]

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []))
}

describe('cekirdek siniri', () => {
  for (const root of ROOTS) {
    it(`${root}: Electron/Node/kabuk bagimliligi yok`, () => {
      const bad: string[] = []
      for (const f of files(root)) {
        const src = readFileSync(f, 'utf8')
        src.split('\n').forEach((line, i) => {
          if (/^\s*(\/\/|\/\*|\*)/.test(line)) return
          if (ALLOW.some((a) => a.test(`${f}:${i + 1}: ${line}`))) return
          if (FORBIDDEN_IMPORT.test(line) || FORBIDDEN_GLOBAL.test(line)) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 90)}`)
        })
      }
      expect(bad).toEqual([])
    })
  }
})
