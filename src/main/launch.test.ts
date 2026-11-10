import { describe, expect, it } from 'vitest'
import { parseLaunch } from './launch'

describe('parseLaunch', () => {
  it('--open mutlak ve goreli yol', () => {
    expect(parseLaunch(['--open=/a/b'])).toEqual({ type: 'dir', dir: '/a/b' })
    expect(parseLaunch(['--open=proj'], '/home/x')).toEqual({ type: 'dir', dir: '/home/x/proj' })
  })
  it('izlix://open?url= yalnizca http(s)', () => {
    expect(parseLaunch(['izlix://open?url=' + encodeURIComponent('http://localhost:3000/x?a=1')])).toEqual({ type: 'url', url: 'http://localhost:3000/x?a=1' })
    expect(parseLaunch(['izlix://open?url=' + encodeURIComponent('javascript:alert(1)')])).toBeNull()
    expect(parseLaunch(['izlix://open?url=' + encodeURIComponent('file:///etc/passwd')])).toBeNull()
  })
  it('izlix://open?dir= yalnizca mutlak yol; bilinmeyen komut reddedilir', () => {
    expect(parseLaunch(['izlix://open?dir=%2Ftmp%2Fp'])).toEqual({ type: 'dir', dir: '/tmp/p' })
    expect(parseLaunch(['izlix://open?dir=rel'])).toBeNull()
    expect(parseLaunch(['izlix://exec?cmd=ls'])).toBeNull()
    expect(parseLaunch(['--other', 'x'])).toBeNull()
  })
})
