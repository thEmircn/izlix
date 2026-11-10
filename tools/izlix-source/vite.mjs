import { annotate } from './transform.mjs'

/** Vite eklentisi: yalnizca `vite dev` (serve). Kullanim: plugins: [izlixSource(), react()] */
export default function izlixSource() {
  return {
    name: 'izlix-source',
    apply: 'serve',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0]
      if (!/\.[jt]sx?$/.test(file) || file.includes('/node_modules/')) return null
      const r = annotate(code, file)
      return r ? { code: r.code, map: r.map } : null
    }
  }
}
