import { tNow } from './store'
import { Component, type ReactNode } from 'react'

/** Bir panelde beklenmedik hata olursa tum kabugu degil yalnizca o paneli hata kartiyla degistirir. */
export class ErrorBoundary extends Component<{ children: ReactNode; label: string; onReset?: () => void }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error): { error: Error } { return { error } }
  componentDidCatch(error: Error): void { console.error(`[panel:${this.props.label}]`, error) }
  componentDidUpdate(prev: { label: string }): void { if (prev.label !== this.props.label && this.state.error) this.setState({ error: null }) }
  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="errcard" role="alert">
        <b>{tNow('err.panel', { n: this.props.label })}</b>
        <code>{String(this.state.error.message).slice(0, 240)}</code>
        <button className="btn primary" onClick={() => { this.setState({ error: null }); this.props.onReset?.() }}>{tNow('err.reload')}</button>
      </div>
    )
  }
}
