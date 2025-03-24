import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { PATHS, DEFAULT_SETTINGS } from '../utils/constants';
import { logger } from '../utils/logger';
import { ClipboardItem } from '../../types/clipboard';
import { BrowserWindow } from 'electron';

export interface StoreSchema {
  clipboardHistory: ClipboardItem[];
  settings: {
    shortcut: string;
    retentionPeriod: number;
    retentionUnit: string;
    rcloneConfig?: string;
  };
}

export interface IStore {
  get(key: string, defaultValue?: any): any;
  set(key: string, value: any): boolean;
  delete(key: string): void;
  clear(): void;
  path: string;
  onDidChange(key: string, callback: (newValue: any, oldValue: any) => void): () => void;
}

class StoreManager implements IStore {
  private data: StoreSchema;
  private emitter: EventEmitter;
  readonly path: string;
  readonly filePath: string;
  private isDirty: boolean = false;
  private saveDebounceTimeout: NodeJS.Timeout | null = null;
  private isLoaded: boolean = false;

  constructor() {
    this.data = {
      clipboardHistory: [],
      settings: DEFAULT_SETTINGS
    };
    this.path = PATHS.userData;
    this.emitter = new EventEmitter();
    this.filePath = path.join(this.path, 'clipboard-history.json');
    this.loadFromFile();
  }

  private getNestedValue(obj: any, path: string) {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  private setNestedValue(obj: any, path: string, value: any) {
    const parts = path.split('.');
    const last = parts.pop()!;
    const target = parts.reduce((acc, part) => acc[part] = acc[part] || {}, obj);
    const oldValue = target[last];
    target[last] = value;
    return oldValue;
  }

  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(fileContent);
        this.isLoaded = true;
        logger.info('Data loaded from file:', this.filePath);
        
        // 数据加载完成后，通知所有窗口初始数据
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('store-change', {
            key: 'clipboardHistory',
            newValue: this.data.clipboardHistory,
            oldValue: []
          });
        });
      } else {
        this.saveToFile();
        this.isLoaded = true;
        logger.info('Created new data file:', this.filePath);
      }
    } catch (error) {
      logger.error('Error loading data from file:', error);
      this.isLoaded = true;
    }
  }

  private saveToFile(): void {
    if (!this.isDirty) return;

    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
      this.isDirty = false;
      logger.info('Data saved to file');
    } catch (error) {
      logger.error('Error saving data to file:', error);
    }
  }

  private debouncedSave(): void {
    if (this.saveDebounceTimeout) {
      clearTimeout(this.saveDebounceTimeout);
    }
    this.saveDebounceTimeout = setTimeout(() => {
      this.saveToFile();
      this.saveDebounceTimeout = null;
    }, 1000);
  }

  public get(key: string, defaultValue?: any): any {
    // 确保数据已加载
    if (!this.isLoaded) {
      logger.warn('Attempting to get data before load completion');
    }
    const value = this.getNestedValue(this.data, key);
    return value === undefined ? defaultValue : value;
  }

  public set(key: string, value: any): boolean {
    try {
      if (!this.isLoaded) {
        logger.warn('Attempting to set data before load completion');
        return false;
      }

      const oldValue = this.getNestedValue(this.data, key);
      this.setNestedValue(this.data, key, value);
      this.isDirty = true;
      this.debouncedSave();
      
      // 通知所有窗口数据变化
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('store-change', {
          key,
          newValue: value,
          oldValue
        });
      });
      
      this.emitter.emit('change', key, value, oldValue);
      return true;
    } catch (error) {
      logger.error('Error setting store value:', error);
      return false;
    }
  }

  public delete(key: string): void {
    if (!this.isLoaded) {
      logger.warn('Attempting to delete data before load completion');
      return;
    }

    const oldValue = this.getNestedValue(this.data, key);
    this.setNestedValue(this.data, key, undefined);
    this.isDirty = true;
    this.debouncedSave();
    this.emitter.emit('change', key, undefined, oldValue);
    
    // 通知所有窗口数据变化
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('store-change', {
        key,
        newValue: undefined,
        oldValue
      });
    });
  }

  public clear(): void {
    if (!this.isLoaded) {
      logger.warn('Attempting to clear data before load completion');
      return;
    }

    const oldData = { ...this.data };
    this.data = {
      clipboardHistory: [],
      settings: DEFAULT_SETTINGS
    };
    this.isDirty = true;
    this.debouncedSave();
    this.emitter.emit('clear');
    
    // 通知所有窗口数据已清空
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('store-clear', {
        oldData,
        newData: this.data
      });
    });
  }

  public onDidChange(key: string, callback: (newValue: any, oldValue: any) => void): () => void {
    const handler = (changedKey: string, newValue: any, oldValue: any) => {
      if (changedKey === key) {
        callback(newValue, oldValue);
      }
    };
    this.emitter.on('change', handler);
    return () => this.emitter.off('change', handler);
  }

  // 新增方法：检查数据是否已加载
  public isDataLoaded(): boolean {
    return this.isLoaded;
  }

  // 新增方法：获取所有数据
  public getAllData(): StoreSchema {
    return { ...this.data };
  }
}

export const store = new StoreManager(); 