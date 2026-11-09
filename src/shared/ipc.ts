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
  wsSwitch: z.object({ id: z.string().max(64) })
}
