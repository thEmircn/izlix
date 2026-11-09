import { describe, expect, it } from 'vitest'
import { resolveInput } from './url'

describe('resolveInput', () => {
  it.each([
    ['localhost:5173', 'http://localhost:5173'],
    ['localhost:3000/app?x=1', 'http://localhost:3000/app?x=1'],
    ['127.0.0.1:8080', 'http://127.0.0.1:8080'],
    ['myapp.local:3000', 'http://myapp.local:3000'],
    ['example.com', 'https://example.com'],
    ['example.com/a/b?c=d', 'https://example.com/a/b?c=d'],
    ['https://a.dev/x', 'https://a.dev/x'],
    ['http://localhost:1', 'http://localhost:1'],
    ['about:blank', 'about:blank'],
    ['react useEffect cleanup', 'https://duckduckgo.com/?q=react%20useEffect%20cleanup'],
    ['', 'about:blank']
  ])('%s -> %s', (input, out) => expect(resolveInput(input)).toBe(out))
})
