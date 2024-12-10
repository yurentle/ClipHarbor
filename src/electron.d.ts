interface ElectronAPI {
  getShortcut: () => Promise<string>;
  setShortcut: (shortcut: string) => Promise<boolean>;
  onShortcutChange: (callback: (shortcut: string) => void) => void;
  platform: () => 'darwin' | 'win32' | 'linux';
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
