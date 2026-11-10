import { useStore } from './store'

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  return <div className="toasts" aria-live="polite">{toasts.map((x) => <div key={x.id} className="toast">{x.text}</div>)}</div>
}
