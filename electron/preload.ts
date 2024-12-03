const { contextBridge, ipcRenderer } = require('electron')

// 定义剪贴板项的类型
interface ClipboardItem {
  id: string
  content: string
  type: 'text' | 'image' | 'file'
  timestamp: number
  favorite: boolean
}

// 定义 API 类型
interface ElectronAPI {
  onClipboardChange: (callback: (content: ClipboardItem) => void) => () => void
  getClipboardHistory: () => Promise<ClipboardItem[]>
  saveToClipboard: (item: ClipboardItem) => Promise<boolean>
  removeFromHistory: (id: string) => Promise<boolean>
  toggleFavorite: (id: string) => Promise<boolean>
  toggleDock: (show: boolean) => Promise<boolean>
  toggleTray: (show: boolean) => Promise<boolean>
  getDefaultShortcut: () => Promise<string>
  closeHistoryWindow: () => Promise<void>
}

// 声明全局类型
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  onClipboardChange: (callback: (content: ClipboardItem) => void) => {
    const subscription = (_event: any, content: ClipboardItem) => callback(content)
    ipcRenderer.on('clipboard-change', subscription)
    return () => {
      ipcRenderer.removeListener('clipboard-change', subscription)
    }
  },
  getClipboardHistory: () => ipcRenderer.invoke('get-clipboard-history'),
  saveToClipboard: (item: ClipboardItem) => ipcRenderer.invoke('save-to-clipboard', item),
  removeFromHistory: (id: string) => ipcRenderer.invoke('remove-from-history', id),
  toggleFavorite: (id: string) => ipcRenderer.invoke('toggle-favorite', id),
  toggleDock: (show: boolean) => ipcRenderer.invoke('toggle-dock', show),
  toggleTray: (show: boolean) => ipcRenderer.invoke('toggle-tray', show),
  getDefaultShortcut: () => ipcRenderer.invoke('get-default-shortcut'),
  closeHistoryWindow: () => ipcRenderer.invoke('close-history-window'),
} as ElectronAPI)
