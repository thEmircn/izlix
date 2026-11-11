import { Menu, type MenuItemConstructorOptions } from 'electron'
import { translate, type Key } from '../shared/i18n'
import type { Language } from '../shared/events'

/**
 * macOS uygulama menüsü. Kısayollar menü hızlandırıcısı olarak tanımlanır: odak sayfa görünümünde
 * (ayrı webContents) olsa bile çalışırlar. Eylemleri shell yürütür (Command Palette ile aynı komut kimlikleri).
 */
export function installMenu(run: (cmd: string) => void, lang: Language = 'tr'): void {
  const t = (k: Key, v?: Record<string, string | number>): string => translate(lang, k, v)
  const c = (label: string, accelerator: string, cmd: string): MenuItemConstructorOptions => ({ label, accelerator, click: () => run(cmd) })
  const template: MenuItemConstructorOptions[] = [
    { label: 'Izlix', submenu: [{ role: 'about' }, { type: 'separator' }, c(t('menu.settings'), 'CmdOrCtrl+,', 'settings.open'), c(t('menu.shortcuts'), 'CmdOrCtrl+/', 'shortcuts.open'), { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
    { label: t('menu.file'), submenu: [c(t('menu.newTab'), 'CmdOrCtrl+T', 'tab.new'), c(t('menu.bmManager'), 'Alt+CmdOrCtrl+B', 'bm.open'), c(t('menu.bmBar'), 'CmdOrCtrl+Shift+B', 'bmbar.toggle'), c(t('menu.history'), 'CmdOrCtrl+Y', 'history.open'), c(t('menu.print'), 'CmdOrCtrl+P', 'page.print'), c(t('menu.savePdf'), 'CmdOrCtrl+Shift+P', 'page.pdf'), c(t('menu.newWindow'), 'CmdOrCtrl+N', 'win.new'), c(t('menu.hopTab'), 'Alt+CmdOrCtrl+M', 'tab.hop'), c(t('menu.newPrivate'), 'CmdOrCtrl+Shift+N', 'tab.newPrivate'), c(t('menu.newTor'), 'CmdOrCtrl+Alt+Shift+N', 'tab.newTor'), c(t('menu.closeTab'), 'CmdOrCtrl+W', 'tab.close'), c(t('menu.reopen'), 'CmdOrCtrl+Shift+T', 'tab.reopen'), c(t('menu.nextTab'), 'Ctrl+Tab', 'tab.next'), c(t('menu.prevTab'), 'Ctrl+Shift+Tab', 'tab.prev'), ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => c(n === 9 ? t('menu.lastTab') : t('menu.selectTab', { n }), `CmdOrCtrl+${n}`, `tab.go.${n}`)), c(t('menu.bookmark'), 'CmdOrCtrl+D', 'bookmark.toggle'), { type: 'separator' }, c(t('menu.openLoc'), 'CmdOrCtrl+L', 'addr.focus'), c(t('menu.find'), 'CmdOrCtrl+F', 'find.open')] },
    { role: 'editMenu' },
    {
      label: t('menu.view'),
      submenu: [
        c(t('menu.palette'), 'CmdOrCtrl+K', 'palette.open'),
        c(t('menu.reload'), 'CmdOrCtrl+R', 'nav.reload'),
        c(t('menu.marker'), 'CmdOrCtrl+Shift+M', 'marker.open'),
        c(t('menu.rules'), 'CmdOrCtrl+Shift+R', 'rules.open'),
        c(t('menu.devtools'), 'Alt+CmdOrCtrl+I', 'devtools.toggle'),
        c(t('menu.panelToggle'), 'Alt+CmdOrCtrl+B', 'panel.toggle'),
        c(t('panel.side.left'), 'Alt+CmdOrCtrl+Left', 'panel.side.left'),
        c(t('panel.side.bottom'), 'Alt+CmdOrCtrl+Down', 'panel.side.bottom'),
        c(t('panel.side.right'), 'Alt+CmdOrCtrl+Right', 'panel.side.right'),
        c(t('menu.dashboard'), 'Alt+CmdOrCtrl+D', 'dashboard.toggle'),
        { type: 'separator' },
        ...(['tl.timeline', 'tl.network', 'tl.console', 'tl.elements', 'tl.sources', 'tl.storage', 'tl.perf', 'tl.coverage', 'tl.a11y', 'tl.profiler', 'tl.seo', 'tl.server', 'tl.components', 'tl.renders'] as Key[]).map((k, i) => i < 9 ? c(t('menu.panel', { n: t(k) }), `Alt+CmdOrCtrl+${i + 1}`, `panel.${i}`) : { label: t('menu.panel', { n: t(k) }), click: () => run(`panel.${i}`) }),
        c(t('menu.fillPw'), 'CmdOrCtrl+Shift+L', 'pw.fill'),
        c(t('menu.reader'), 'Alt+CmdOrCtrl+R', 'reader.toggle'),
        { type: 'separator' }, c(t('menu.zoomReset'), 'CmdOrCtrl+0', 'zoom.reset'), c(t('menu.zoomIn'), 'CmdOrCtrl+Plus', 'zoom.in'), c(t('menu.zoomOut'), 'CmdOrCtrl+-', 'zoom.out'),
        { type: 'separator' }, { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
