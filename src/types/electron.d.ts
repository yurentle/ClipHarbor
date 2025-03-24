import { ClipboardItem } from './clipboard'

type UpdateInfo = {
  hasUpdate: boolean;
  version?: string;
  releaseNotes?: string;
  downloadUrl?: string;
}

// Store API
export interface StoreAPI {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  onDidChange: (callback: (newValue: any, oldValue: any) => void) => () => void;
}

// Clipboard API
interface ClipboardAPI {
  saveToClipboard: (item: ClipboardItem) => Promise<boolean>;
  getHistory: () => Promise<ClipboardItem[]>;
  removeFromHistory: (id: string) => Promise<boolean>;
  toggleFavorite: (id: string) => Promise<boolean>;
  onClipboardChange: (callback: (item: ClipboardItem) => void) => () => void;
}

// Window API
interface WindowAPI {
  closeHistoryWindow: () => Promise<boolean>;
  openSettingsWindow: () => Promise<void>;
  closeSettingsWindow: () => Promise<void>;
  isDevToolsOpened: () => boolean;
}

// System API
interface SystemAPI {
  openExternal: (url: string) => Promise<void>;
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<UpdateInfo>;
  openStoreDirectory: () => Promise<void>;
  getHistoryFilePath: () => Promise<string>;
  registerShortcut: (shortcut: string) => Promise<boolean>;
}

// Sync API
interface SyncAPI {
  syncData: (config: string, processId: string) => Promise<boolean>;
  syncDataFromCloud: (config: string, processId: string) => Promise<boolean>;
  cancelSync: (processId: string) => Promise<boolean>;
  onSyncProgress: (callback: (data: { processId: string; data: string }) => void) => () => void;
}

// IPC API
interface IpcAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, func: (...args: any[]) => void) => void;
  removeListener: (channel: string, func: (...args: any[]) => void) => void;
}

// Main ElectronAPI interface
export interface ElectronAPI {
  store: StoreAPI;
  clipboard: ClipboardAPI;
  window: WindowAPI;
  system: SystemAPI;
  sync: SyncAPI;
  ipcRenderer: IpcAPI;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}