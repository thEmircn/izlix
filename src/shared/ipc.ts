import { z } from 'zod'

// IPC izin listesi: shell <-> main. Her mesaj zod ile dogrulanir (plan bolum 4, guvenlik).
export { Ch } from './channels'

export const schemas = {
  tabsCreate: z.object({ url: z.string().max(4096).optional() }),
  tabId: z.object({ id: z.string().max(64) }),
  navGo: z.object({ id: z.string().max(64), input: z.string().max(4096) }),
  sourceOpen: z.object({
    file: z.string().max(4096), line: z.number().int().positive(),
    column: z.number().int().positive().optional(),
    editor: z.enum(['vscode', 'cursor', 'webstorm']).optional()
  }),
  layoutSet: z.object({
    dock: z.enum(['right', 'bottom', 'off']),
    panelRatio: z.number().min(0.2).max(0.8),
    chromeHeight: z.number().int().min(40).max(200)
  }),
  wsCreate: z.object({ name: z.string().min(1).max(64), rootDir: z.string().max(4096).nullable() }),
  wsSwitch: z.object({ id: z.string().max(64) }),
  rulesSet: z.object({
    wsId: z.string().max(64),
    domains: z.array(z.string().max(253)).max(100),
    rules: z.array(z.object({
      id: z.string().max(64), name: z.string().max(200), enabled: z.boolean(),
      urlPattern: z.string().min(1).max(2048), method: z.string().max(16).optional(),
      action: z.discriminatedUnion('type', [
        z.object({ type: z.literal('redirect'), to: z.string().max(4096) }),
        z.object({ type: z.literal('headers'), set: z.record(z.string().max(256), z.string().max(4096)), remove: z.array(z.string().max(256)).max(50).optional() }),
        z.object({ type: z.literal('mock'), status: z.number().int().min(100).max(599), body: z.string().max(2_000_000), contentType: z.string().max(128) }),
        z.object({ type: z.literal('delay'), ms: z.number().int().min(0).max(60_000) }),
        z.object({ type: z.literal('status'), code: z.number().int().min(100).max(599) })
      ])
    })).max(500)
  }),
  overlay: z.object({ open: z.boolean() })
}
