/**
 * Platformdan bagimsiz CDP istemcisi: Electron (webContents.debugger), Chrome eklentisi (chrome.debugger) veya
 * dogrudan WebSocket arkasinda ayni arayuz. Cekirdek yalnizca bunu bilir.
 */
export interface CdpClient {
  /** CDP komutu gonder */
  send(method: string, params?: object): Promise<any>
  /** CDP olaylarini dinle; donen fonksiyon aboneligi kaldirir */
  onEvent(fn: (method: string, params: any) => void): () => void
  /** oturumu kapat (hata vermez) */
  detach(): void
}
