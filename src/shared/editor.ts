// Editoru YENI pencerede acma komutu (saf). Acik editor pencerelerine (ve icindeki oturumlara) dokunmamak icin URL semasi yerine CLI + -n.
import type { Editor } from './events'
export interface EditorCmd { bins: string[]; args: string[] }

const BINS: Record<Editor, string[]> = {
  vscode: ['/usr/local/bin/code', '/opt/homebrew/bin/code', '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'],
  cursor: ['/usr/local/bin/cursor', '/opt/homebrew/bin/cursor', '/Applications/Cursor.app/Contents/Resources/app/bin/cursor'],
  webstorm: ['/usr/local/bin/webstorm', '/opt/homebrew/bin/webstorm']
}
/** `root` (proje klasoru) varsa klasor yeni pencerede acilir ve dosya o satira gidilir; yoksa yalniz dosya */
export function editorCommand(editor: Editor, target: { file?: string; line?: number; column?: number; root?: string | null }): EditorCmd {
  const bins = BINS[editor]
  const loc = target.file ? `${target.file}:${Math.max(1, target.line ?? 1)}:${Math.max(1, target.column ?? 1)}` : ''
  if (editor === 'webstorm') return { bins, args: target.file ? ['--line', String(target.line ?? 1), '--column', String(target.column ?? 1), target.file] : [target.root ?? ''].filter(Boolean) }
  const args = ['-n']
  if (target.root) args.push(target.root)
  if (loc) args.push('-g', loc)
  return { bins, args }
}
