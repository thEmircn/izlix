import { keyLabel } from '../shared/keys'

/** macOS mi (kisayol simgeleri ve pencere duzeni icin) */
export const IS_MAC = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent || '')
/** kisayol etiketi: macOS'ta simgeler, digerlerinde "Ctrl+Shift+F" */
export const K = (label: string): string => keyLabel(label, IS_MAC)
