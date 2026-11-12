import { createRoot } from 'react-dom/client'
import './styles.css'
import './native.css'
import { App } from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { IS_MAC } from './platform'
document.documentElement.dataset.mac = IS_MAC ? '1' : ''
// web davranislarini kapat: dosya birakinca sayfa gezinmesi, arayuzde tarayici sag tik menusu
addEventListener('dragover', (e) => e.preventDefault()); addEventListener('drop', (e) => e.preventDefault())
addEventListener('contextmenu', (e) => { const t = e.target as HTMLElement | null; if (!t?.closest('input, textarea, [contenteditable=true], pre, code, .con-row, .net-row, .codebody')) e.preventDefault() })
createRoot(document.getElementById('root')!).render(<ErrorBoundary label="app" onReset={() => location.reload()}><App /></ErrorBoundary>)
