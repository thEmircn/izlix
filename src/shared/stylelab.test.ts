import { describe, expect, it } from 'vitest'
import { cssRule, parseInline, px, rgbToHex, stringifyInline, toTailwind } from './stylelab'

describe('stylelab temel', () => {
  it('inline stil ayristirma ve geri yazma', () => {
    expect(parseInline('color: red; margin:0 ;;')).toEqual({ color: 'red', margin: '0' })
    expect(stringifyInline({ color: 'red', margin: '0' })).toBe('color: red; margin: 0')
  })
  it('px, renk ve css kurali', () => {
    expect(px('12px')).toBe(12); expect(px('1.5')).toBe(1.5); expect(px('2em')).toBeNull()
    expect(rgbToHex('rgb(255, 106, 43)')).toBe('#ff6a2b'); expect(rgbToHex('rgba(0,0,0,0.5)')).toBe('#000000')
    expect(cssRule('#a > .b', { color: 'red', 'font-size': '18px' })).toBe('#a > .b {\n  color: red;\n  font-size: 18px;\n}')
    expect(cssRule('x', {})).toBe('')
  })
})

describe('toTailwind', () => {
  it('bosluklar birlesir: hepsi esit, dikey/yatay, tek tek, arbitrary', () => {
    expect(toTailwind({ 'padding-top': '16px', 'padding-right': '16px', 'padding-bottom': '16px', 'padding-left': '16px' }).classes).toEqual(['p-4'])
    expect(toTailwind({ 'padding-top': '8px', 'padding-bottom': '8px', 'padding-left': '24px', 'padding-right': '24px' }).classes).toEqual(['py-2', 'px-6'])
    expect(toTailwind({ 'margin-top': '13px' }).classes).toEqual(['mt-[13px]']); expect(toTailwind({ 'margin-top': '10px' }).classes).toEqual(['mt-2.5'])
    expect(toTailwind({ 'margin-top': '1px', 'margin-right': '0px', 'margin-bottom': '2px', 'margin-left': '4px' }).classes).toEqual(['mt-px', 'mr-0', 'mb-0.5', 'ml-1'])
  })
  it('tipografi, renk, kenar, golge, yerlesim', () => {
    const r = toTailwind({ 'font-size': '18px', 'font-weight': '600', 'line-height': '1.5', color: 'rgb(255, 106, 43)', 'border-radius': '8px', opacity: '0.5', display: 'flex', 'flex-direction': 'column', 'justify-content': 'space-between', 'align-items': 'center', gap: '12px', 'box-shadow': '0 4px 6px rgba(0,0,0,.25)', width: '100%' })
    expect(r.classes).toEqual(expect.arrayContaining(['text-lg', 'font-semibold', 'leading-normal', 'text-[rgb(255,106,43)]', 'rounded-lg', 'opacity-50', 'flex', 'flex-col', 'justify-between', 'items-center', 'gap-3', 'shadow-md', 'w-full']))
    expect(r.unmapped).toEqual({})
  })
  it('karsiligi olmayan ozellik unmapped kalir', () => {
    const r = toTailwind({ 'text-decoration': 'underline', 'font-size': '13px' })
    expect(r.classes).toEqual(['text-[13px]']); expect(r.unmapped).toEqual({ 'text-decoration': 'underline' })
  })
})
