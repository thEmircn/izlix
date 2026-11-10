import { Menu, type MenuItemConstructorOptions } from 'electron'

/**
 * macOS uygulama menüsü. Kısayollar menü hızlandırıcısı olarak tanımlanır: odak sayfa görünümünde
 * (ayrı webContents) olsa bile çalışırlar. Eylemleri shell yürütür (Command Palette ile aynı komut kimlikleri).
 */
export function installMenu(run: (cmd: string) => void): void {
  const c = (label: string, accelerator: string, cmd: string): MenuItemConstructorOptions => ({ label, accelerator, click: () => run(cmd) })
  const template: MenuItemConstructorOptions[] = [
    { label: 'Izlix', submenu: [{ role: 'about' }, { type: 'separator' }, c('Settings…', 'CmdOrCtrl+,', 'settings.open'), { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'File', submenu: [c('New Tab', 'CmdOrCtrl+T', 'tab.new'), c('Close Tab', 'CmdOrCtrl+W', 'tab.close'), c('Reopen Closed Tab', 'CmdOrCtrl+Shift+T', 'tab.reopen'), c('Bookmark This Page', 'CmdOrCtrl+D', 'bookmark.toggle'), { type: 'separator' }, c('Open Location…', 'CmdOrCtrl+L', 'addr.focus'), c('Find in Page…', 'CmdOrCtrl+F', 'find.open')] },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        c('Command Palette…', 'CmdOrCtrl+K', 'palette.open'),
        c('Reload', 'CmdOrCtrl+R', 'nav.reload'),
        c('Request Rules…', 'CmdOrCtrl+Shift+R', 'rules.open'),
        c('Toggle DevTools', 'Alt+CmdOrCtrl+I', 'devtools.toggle'),
        { type: 'separator' },
        ...['Timeline', 'Network', 'Console', 'Elements', 'Storage', 'Performance', 'Accessibility', 'Components', 'Renders'].map((n, i) => c(`Panel: ${n}`, `Alt+CmdOrCtrl+${i + 1}`, `panel.${i}`)),
        { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
