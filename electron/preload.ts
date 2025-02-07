import { contextBridge, ipcRenderer } from 'electron'

// 为了 TypeScript 的类型检查
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

interface ElectronAPI {
  onClipboardChange: (callback: (newItem: any) => void) => () => void
  getClipboardHistory: () => Promise<any[]>
  saveToClipboard: (item: any) => Promise<boolean>
  removeFromHistory: (id: string) => Promise<boolean>
  toggleFavorite: (id: string) => Promise<boolean>
  getStoreValue: (key: string) => Promise<any>
  setStoreValue: (key: string, value: any) => Promise<boolean>
  closeHistoryWindow: () => Promise<void>
  openSettingsWindow: () => Promise<void>
  openLocalFolder: () => Promise<void>
  setAutoHide: (value: boolean) => Promise<boolean>
  getAutoHide: () => Promise<boolean>
}

// 使用 contextBridge 暴露 API
contextBridge.exposeInMainWorld('electronAPI', {
  onClipboardChange: (callback: (newItem: any) => void) => {
    ipcRenderer.on('clipboard-change', (_event, value) => callback(value))
    return () => {
      ipcRenderer.removeAllListeners('clipboard-change')
    }
  },
  saveToClipboard: (item: any) => ipcRenderer.invoke('save-to-clipboard', item),
  getClipboardHistory: () => ipcRenderer.invoke('get-clipboard-history'),
  removeFromHistory: (id: string) => ipcRenderer.invoke('remove-from-history', id),
  toggleFavorite: (id: string) => ipcRenderer.invoke('toggle-favorite', id),
  getStoreValue: (key: string) => ipcRenderer.invoke('get-store-value', key),
  setStoreValue: (key: string, value: any) => ipcRenderer.invoke('set-store-value', key, value),
  closeHistoryWindow: () => ipcRenderer.invoke('close-history-window'),
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
  openLocalFolder: () => ipcRenderer.invoke('open-local-folder'),
  setAutoHide: (value: boolean) => ipcRenderer.invoke('set-auto-hide', value),
  getAutoHide: () => ipcRenderer.invoke('get-auto-hide'),
} as ElectronAPI)
