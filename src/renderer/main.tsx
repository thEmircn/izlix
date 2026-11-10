import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './App'
import { ErrorBoundary } from './ErrorBoundary'
createRoot(document.getElementById('root')!).render(<ErrorBoundary label="app" onReset={() => location.reload()}><App /></ErrorBoundary>)
