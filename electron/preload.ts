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
  toggleFavorite: (id: string) => ipcRenderer.invoke('toggle-favorite', id)
} as ElectronAPI)
