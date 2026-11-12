import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { installRipple } from './ripple'
import { IS_MAC } from './platform'
document.documentElement.dataset.mac = IS_MAC ? '1' : ''
installRipple()
createRoot(document.getElementById('root')!).render(<ErrorBoundary label="app" onReset={() => location.reload()}><App /></ErrorBoundary>)
