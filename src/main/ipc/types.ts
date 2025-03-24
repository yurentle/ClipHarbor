import { IpcMainInvokeEvent } from 'electron';
import { ClipboardItem } from '../../types/clipboard';

export type IpcHandler = (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any>;

export interface StoreHandlers {
  'store-get': (event: IpcMainInvokeEvent, key: string) => Promise<any>;
  'store-set': (event: IpcMainInvokeEvent, key: string, value: any) => Promise<boolean>;
  'store-delete': (event: IpcMainInvokeEvent, key: string) => Promise<void>;
  'store-clear': (event: IpcMainInvokeEvent) => Promise<void>;
}

export interface ClipboardHandlers {
  'save-to-clipboard': (event: IpcMainInvokeEvent, item: ClipboardItem) => Promise<boolean>;
  'get-clipboard-history': (event: IpcMainInvokeEvent) => Promise<ClipboardItem[]>;
  'remove-from-history': (event: IpcMainInvokeEvent, id: string) => Promise<boolean>;
  'toggle-favorite': (event: IpcMainInvokeEvent, id: string) => Promise<boolean>;
}

export interface WindowHandlers {
  'close-history-window': (event: IpcMainInvokeEvent) => Promise<boolean>;
  'open-settings-window': (event: IpcMainInvokeEvent) => Promise<void>;
  'close-settings-window': (event: IpcMainInvokeEvent) => Promise<void>;
}

export interface SystemHandlers {
  'open-external': (event: IpcMainInvokeEvent, url: string) => Promise<void>;
  'get-app-version': (event: IpcMainInvokeEvent) => Promise<string>;
  'check-for-updates': (event: IpcMainInvokeEvent) => Promise<{
    hasUpdate: boolean;
    version?: string;
    releaseNotes?: string;
    downloadUrl?: string;
  }>;
  'open-store-directory': (event: IpcMainInvokeEvent) => Promise<void>;
  'get-history-file-path': (event: IpcMainInvokeEvent) => Promise<string>;
  'register-shortcut': (event: IpcMainInvokeEvent, shortcut: string) => Promise<boolean>;
}

export interface SyncHandlers {
  'sync-data': (event: IpcMainInvokeEvent, config: string, processId: string) => Promise<boolean>;
  'sync-data-from-cloud': (event: IpcMainInvokeEvent, config: string, processId: string) => Promise<boolean>;
  'cancel-sync': (event: IpcMainInvokeEvent, processId: string) => Promise<boolean>;
}

export type IpcHandlers = 
  & StoreHandlers 
  & ClipboardHandlers 
  & WindowHandlers 
  & SystemHandlers 
  & SyncHandlers; 