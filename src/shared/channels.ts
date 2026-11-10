// Kanal adlari: bagimliligi yok, sandbox'li preload bunu guvenle import eder (zod burada OLMAMALI).
export const Ch = {
  tabsCreate: 'tabs:create', tabsClose: 'tabs:close', tabsActivate: 'tabs:activate',
  navGo: 'nav:go', navBack: 'nav:back', navForward: 'nav:forward', navReload: 'nav:reload',
  sourceOpen: 'source:open', layoutSet: 'layout:set', snapshot: 'state:snapshot',
  wsCreate: 'ws:create', wsSwitch: 'ws:switch',
  rulesSet: 'rules:set', reportExport: 'report:export', libHistory: 'lib:history', bookmarkToggle: 'lib:bookmark', downloadShow: 'dl:show', settingsGet: 'settings:get', settingsSet: 'settings:set', track: 'telemetry:track', demoOpen: 'demo:open', mediaSet: 'media:set', snapshotSave: 'snap:save', reqBody: 'req:body', wsRename: 'ws:rename', wsDelete: 'ws:delete', findStart: 'find:start', findStop: 'find:stop', tabsReopen: 'tabs:reopen', dtCall: 'dt:call', dtEnable: 'dt:enable', dtDisable: 'dt:disable', dtReact: 'dt:react', dtEval: 'dt:eval', emuSet: 'emu:set', shot: 'shot:take', a11y: 'a11y:audit', flash: 'react:flash', cacheSet: 'net:cache', tabMenu: 'tabs:menu', hookSet: 'react:hook', propSet: 'react:prop', dtReactIdx: 'dt:reactidx', harSave: 'net:har', labSet: 'lab:set', inspTree: 'insp:tree', inspNode: 'insp:node', overlay: 'ui:overlay',
  // main -> shell
  evNew: 'events:new', evUpdate: 'events:update', tabsState: 'tabs:state', wsState: 'ws:state', rulesState: 'rules:state', libState: 'lib:state', settingsState: 'settings:state', dtEvent: 'dt:event', findResult: 'find:result', cmd: 'ui:cmd'
} as const
