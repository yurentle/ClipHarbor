import { contextBridge, ipcRenderer } from 'electron'

// 为了 TypeScript 的类型检查
declare global {
  interface Window {
    electron: ElectronAPI
  }
}

interface ElectronAPI {
  onClipboardChange: (callback: (content: any) => void) => () => void
  getClipboardHistory: () => Promise<any[]>
  saveToClipboard: (item: any) => Promise<boolean>
  removeFromHistory: (id: string) => Promise<boolean>
  toggleFavorite: (id: string) => Promise<boolean>
  toggleDock: (show: boolean) => Promise<boolean>
  toggleTray: (show: boolean) => Promise<boolean>
  getDefaultShortcut: () => Promise<string>
  closeHistoryWindow: () => Promise<void>
  toggleDockIcon: (show: boolean) => Promise<boolean>
  toggleTrayIcon: (show: boolean) => Promise<boolean>
}

// 使用 contextBridge 暴露 API
contextBridge.exposeInMainWorld('electron', {
  onClipboardChange: (callback: (content: any) => void) => {
    const unsubscribe = ipcRenderer.on('clipboard-change', (_, content) => {
      callback(content)
    })
    return () => {
      unsubscribe()
    }
  },
  getClipboardHistory: () => ipcRenderer.invoke('get-clipboard-history'),
  saveToClipboard: (item: any) => ipcRenderer.invoke('save-to-clipboard', item),
  removeFromHistory: (id: string) => ipcRenderer.invoke('remove-from-history', id),
  toggleFavorite: (id: string) => ipcRenderer.invoke('toggle-favorite', id),
  toggleDock: (show: boolean) => ipcRenderer.invoke('toggle-dock', show),
  toggleTray: (show: boolean) => ipcRenderer.invoke('toggle-tray', show),
  getDefaultShortcut: () => ipcRenderer.invoke('get-default-shortcut'),
  closeHistoryWindow: () => ipcRenderer.invoke('close-history-window'),
  toggleDockIcon: (show: boolean) => ipcRenderer.invoke('toggle-dock-icon', show),
  toggleTrayIcon: (show: boolean) => ipcRenderer.invoke('toggle-tray-icon', show)
} as ElectronAPI)
