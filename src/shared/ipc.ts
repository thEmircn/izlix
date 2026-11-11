import { z } from 'zod'

// IPC izin listesi: shell <-> main. Her mesaj zod ile dogrulanir (plan bolum 4, guvenlik).
export { Ch } from './channels'

export const schemas = {
  faviconsGet: z.object({ origins: z.array(z.string().max(300)).max(200) }),
  defaultBrowser: z.object({ set: z.boolean() }),
  tabSleep: z.object({ id: z.string().max(64).nullable() }),
  adMenu: z.object({ host: z.string().max(253) }),
  tabHop: z.object({ id: z.string().max(64) }),
  tabMute: z.object({ id: z.string().max(64), muted: z.boolean() }),
  tabPin: z.object({ id: z.string().max(64), pinned: z.boolean() }),
  suggestRemote: z.object({ q: z.string().min(1).max(100) }),
  thumbGet: z.object({ url: z.string().max(4096) }),
  tabsCreate: z.object({ url: z.string().max(4096).optional(), private: z.enum(['incognito', 'tor']).optional() }),
  tabId: z.object({ id: z.string().max(64) }),
  navGo: z.object({ id: z.string().max(64), input: z.string().max(4096) }),
  sourceOpen: z.object({
    file: z.string().max(4096), line: z.number().int().positive(),
    column: z.number().int().positive().optional(),
    editor: z.enum(['vscode', 'cursor', 'webstorm']).optional()
  }),
  layoutSet: z.object({
    dock: z.enum(['right', 'bottom', 'off']),
    panelRatio: z.number().min(0).max(0.8), // 0 = yan panel kapali (sayfa tam genislik)
    side: z.enum(['right', 'left', 'bottom']).optional(),
    chromeHeight: z.number().int().min(40).max(200),
    split: z.number().min(0.2).max(0.8).optional()
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
        z.object({ type: z.literal('status'), code: z.number().int().min(100).max(599) }),
        z.object({ type: z.literal('block') })
      ])
    })).max(500)
  }),
  inspNode: z.object({ id: z.string().max(64), node: z.number().int().min(0), t: z.number().int().optional(), name: z.string().max(200) }),
  labSet: z.object({ id: z.string().max(64), devices: z.array(z.string().max(40)).max(4).nullable() }),
  downloadShow: z.object({ id: z.string().max(64) }),
  settingsSet: z.object({ telemetry: z.enum(['unset', 'granted', 'denied']).optional(), onboarded: z.boolean().optional(), language: z.enum(['en', 'tr']).optional(), autoOpen: z.boolean().optional(), searchSuggest: z.boolean().optional(), ambient: z.boolean().optional(), stripTracking: z.boolean().optional(), cookieBanners: z.boolean().optional(), stripTrackingDev: z.boolean().optional(), sleepMinutes: z.number().int().min(0).max(1440).optional(), adblock: z.enum(['off', 'ads', 'strict']).optional(), adblockAllow: z.array(z.string().max(120)).max(500).optional(), searchEngine: z.enum(['duckduckgo', 'google', 'yandex', 'bing', 'brave']).optional() }),
  track: z.object({ name: z.string().max(40), props: z.record(z.string().max(40), z.union([z.string().max(40), z.number(), z.boolean()])).optional() }),
  mediaSet: z.object({ id: z.string().max(64), colorScheme: z.enum(['light', 'dark']).nullable(), reducedMotion: z.boolean() }),
  reqBody: z.object({ id: z.string().max(64), requestId: z.string().max(128) }),
  wsRename: z.object({ id: z.string().max(64), name: z.string().min(1).max(64) }),
  findStart: z.object({ id: z.string().max(64), text: z.string().min(1).max(200), forward: z.boolean(), next: z.boolean() }),
  dtCall: z.object({ id: z.string().max(64), method: z.string().max(80), params: z.record(z.string(), z.any()).optional() }),
  dtFeature: z.object({ id: z.string().max(64), feature: z.enum(['elements', 'storage', 'perf', 'coverage', 'profile', 'sw']) }),
  dtReact: z.object({ id: z.string().max(64), nodeId: z.number().int().min(0) }),
  dtEval: z.object({ id: z.string().max(64), expression: z.string().min(1).max(20000) }),
  emuSet: z.object({ id: z.string().max(64), network: z.string().max(20).nullable().optional(), cpu: z.number().int().min(1).max(20).nullable().optional(), geo: z.string().max(20).nullable().optional(), ua: z.string().max(20).nullable().optional(), touch: z.boolean().nullable().optional(), vision: z.string().max(20).nullable().optional(), contrast: z.enum(['more', 'less']).nullable().optional(), forcedColors: z.boolean().nullable().optional(), print: z.boolean().nullable().optional() }),
  shot: z.object({ id: z.string().max(64), kind: z.enum(['viewport', 'full', 'node']), nodeId: z.number().int().min(0).optional(), copy: z.boolean().optional() }),
  flash: z.object({ id: z.string().max(64), on: z.boolean() }),
  cacheSet: z.object({ id: z.string().max(64), disabled: z.boolean() }),
  hookSet: z.object({ id: z.string().max(64), node: z.number().int().min(0), index: z.number().int().min(0).max(200), json: z.string().max(20000) }),
  propSet: z.object({ id: z.string().max(64), node: z.number().int().min(0), key: z.string().max(200), json: z.string().max(20000) }),
  permAnswer: z.object({ id: z.string().max(64), answer: z.enum(['allow-once', 'allow', 'block']) }),
  permRemove: z.object({ origin: z.string().max(300), permission: z.string().max(40) }),
  tabMove: z.object({ id: z.string().max(64), index: z.number().int().min(0).max(1000) }),
  srvStart: z.object({ wsId: z.string().max(64), script: z.string().max(100) }),
  wsId: z.object({ wsId: z.string().max(64) }),
  marker: z.object({ id: z.string().max(64), text: z.string().min(1).max(200) }),
  srcLoad: z.object({ id: z.string().max(64), url: z.string().max(4096) }),
  srcPos: z.object({ id: z.string().max(64), url: z.string().max(4096), line: z.number().int().min(1), col: z.number().int().min(1) }),
  dbgBp: z.object({ id: z.string().max(64), action: z.enum(['set', 'remove']), bpId: z.string().max(200).optional(), url: z.string().max(4096).optional(), file: z.string().max(4096).optional(), line: z.number().int().min(1).optional(), condition: z.string().max(2000).optional() }),
  dbgCtl: z.object({ id: z.string().max(64), cmd: z.enum(['resume', 'stepOver', 'stepInto', 'stepOut', 'pause']) }),
  dbgEvBp: z.object({ id: z.string().max(64), kind: z.enum(['event', 'xhr']), name: z.string().max(500), on: z.boolean() }),
  tabSplit: z.object({ other: z.string().max(64).nullable() }),
  sessSave: z.object({ name: z.string().max(100) }),
  sessOpen: z.object({ id: z.string().max(80), replace: z.boolean().optional() }),
  sessDelete: z.object({ id: z.string().max(80) }),
  dbgExc: z.object({ id: z.string().max(64), state: z.enum(['none', 'uncaught', 'all']) }),
  dbgScope: z.object({ id: z.string().max(64), objectId: z.string().max(500) }),
  dbgEval: z.object({ id: z.string().max(64), frameId: z.string().max(500), expression: z.string().min(1).max(20000) }),
  overlay: z.object({ open: z.boolean() })
}
