import { ClipboardItem } from './clipboard'

export interface ElectronAPI {
  onClipboardChange: (callback: (newItem: ClipboardItem) => void) => () => void
  getClipboardHistory: () => Promise<ClipboardItem[]>
  saveToClipboard: (item: ClipboardItem) => Promise<void>
  removeFromHistory: (id: string) => Promise<boolean>
  toggleFavorite: (id: string) => Promise<boolean>
  closeHistoryWindow: () => Promise<void>
  getStoreValue: (key: string) => Promise<any>
  setStoreValue: (key: string, value: any) => Promise<boolean>
  syncData: (config: string) => Promise<boolean>
  syncDataFromCloud: (config: string) => Promise<boolean>
  openStoreDirectory: () => Promise<void>
  getHistoryFilePath: () => Promise<string>
  openSettingsWindow: () => Promise<boolean>
  closeSettingsWindow: () => Promise<boolean>
  openExternal: (url: string) => Promise<boolean>
  getAppVersion: () => Promise<string>
  isDevToolsOpened: () => boolean
}