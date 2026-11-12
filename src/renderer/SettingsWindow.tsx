import { useEffect } from 'react'
import { Settings } from './Settings'
import { useStore } from './store'

/** Ayri Ayarlar penceresi: kabugun ayar durumunu getirir, degisiklikleri ana pencereye iletir (BroadcastChannel). */
export function SettingsWindow() {
  useEffect(() => {
    const api = window.izlix
    void api.getSettings().then((st: any) => useStore.getState().set({ settings: st }))
    const off = api.onSettings((st: any) => useStore.getState().set({ settings: st }))
    return () => { off() }
  }, [])
  return <Settings onClose={() => window.close()} />
}
