// Kanal adlari: bagimliligi yok, sandbox'li preload bunu guvenle import eder (zod burada OLMAMALI).
export const Ch = {
  tabsCreate: 'tabs:create', tabsClose: 'tabs:close', tabsActivate: 'tabs:activate',
  navGo: 'nav:go', navBack: 'nav:back', navForward: 'nav:forward', navReload: 'nav:reload',
  sourceOpen: 'source:open', layoutSet: 'layout:set', snapshot: 'state:snapshot',
  wsCreate: 'ws:create', wsSwitch: 'ws:switch',
  // main -> shell
  evNew: 'events:new', evUpdate: 'events:update', tabsState: 'tabs:state', wsState: 'ws:state'
} as const
