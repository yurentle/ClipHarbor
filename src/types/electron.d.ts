export interface ClipboardItem {
  id: string
  content: string
  type: 'text' | 'image' | 'file'
  timestamp: number
  favorite: boolean
  metadata?: {
    width?: number
    height?: number
    size?: number
  }
}

export interface ElectronAPI {
  onClipboardChange: (callback: (content: ClipboardItem) => void) => () => void
  getClipboardHistory: () => Promise<ClipboardItem[]>
  saveToClipboard: (item: ClipboardItem) => Promise<boolean>
  removeFromHistory: (id: string) => Promise<boolean>
  toggleFavorite: (id: string) => Promise<boolean>
  toggleDock: (show: boolean) => Promise<boolean>
  toggleTray: (show: boolean) => Promise<boolean>
  getDefaultShortcut: () => Promise<string>
  setShortcut: (shortcut: string) => Promise<boolean>
  closeHistoryWindow: () => Promise<void>
  toggleDockIcon: (show: boolean) => Promise<boolean>
  toggleTrayIcon: (show: boolean) => Promise<boolean>
}