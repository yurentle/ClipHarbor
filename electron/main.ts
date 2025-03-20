import { app, BrowserWindow, clipboard, ipcMain, nativeImage, globalShortcut, Tray, Menu, shell, MenuItemConstructorOptions } from 'electron';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { execFile, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { ClipboardItem, ClipboardHistory } from '../src/types/clipboard';
import { EventEmitter } from 'events';

declare global {
  var clipboardInterval: NodeJS.Timeout | undefined;
}

// 1. 基本常量定义
const isMac = process.platform === 'darwin';
const historyFileName = 'clipboard-history.json';
const __dirname = path.dirname(__filename);

// 2. 日志相关设置 - 重新组织顺序
const getLogPath = () => {
  const userDataPath = app.getPath('userData');
  return app.isPackaged 
    ? path.join(userDataPath, 'logs')
    : path.join(userDataPath, 'logs-dev');
};

const logPath = getLogPath();

// 确保日志目录存在
try {
  if (!fs.existsSync(logPath)) {
    fs.mkdirSync(logPath, { recursive: true });
    console.log('Created log directory at:', logPath);
  }
} catch (error) {
  console.error('Failed to create log directory:', error);
}

// 先定义 logFile 变量
const logFile = path.join(logPath, `app-${new Date().toISOString().split('T')[0]}.log`);

// 创建日志函数
function log(...args: any[]) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : arg
  ).join(' ');
  
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  try {
    // 写入日志文件
    fs.appendFileSync(logFile, logMessage);
    // 同时输出到控制台
    console.log(message);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
}

// 现在可以安全地调用 log 函数
log('Log path:', logPath);

// 3. 全局变量声明
let settingWindow: BrowserWindow | null = null;
let historyWindow: BrowserWindow | null = null;
let contextMenu: Menu | null = null;
let isQuitting = false;

// 4. 错误处理
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (error.message.includes('Cannot find module')) {
    console.error('Module not found error. Please check your dependencies.');
  }
});

// 5. 类型定义
interface StoreSchema {
  clipboardHistory: ClipboardItem[];
  settings: {
    shortcut: string;
    retentionPeriod: number;
    retentionUnit: string;
    rcloneConfig?: string;
  };
}

type StoreKey = string;

// 修改存储接口
interface IStore {
  get(key: StoreKey, defaultValue?: any): any;
  set(key: StoreKey, value: any): boolean;
  delete(key: StoreKey): void;
  clear(): void;
  path: string;
  onDidChange(key: StoreKey, callback: (newValue: any, oldValue: any) => void): () => void;
}

// 修改 BackupStore 类的实现
class BackupStore implements IStore {
  private data: StoreSchema;
  private emitter: EventEmitter;
  readonly path: string;
  private filePath: string;
  private isDirty: boolean = false;  // 添加一个标记来追踪数据是否被修改

  constructor(defaultData: StoreSchema, storePath: string) {
    this.data = defaultData;
    this.path = storePath;
    this.emitter = new EventEmitter();
    this.filePath = path.join(storePath, 'clipboard-history.json');

    // 尝试从文件加载数据
    this.loadFromFile();
  }

  private loadFromFile() {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(fileContent);
        log('Data loaded from file:', this.filePath);
      } else {
        this.saveToFile(); // 如果文件不存在，创建文件并保存默认数据
        log('Created new data file:', this.filePath);
      }
    } catch (error) {
      console.error('Error loading data from file:', error);
    }
  }

  private saveToFile() {
    if (!this.isDirty) return;  // 如果数据没有修改，不需要保存

    try {
      // 确保目录存在
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      // 保存数据到文件
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
      this.isDirty = false;  // 重置修改标记
    } catch (error) {
      console.error('Error saving data to file:', error);
    }
  }

  private getNestedValue(obj: any, path: string) {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  private setNestedValue(obj: any, path: string, value: any) {
    const parts = path.split('.');
    const last = parts.pop()!;
    const target = parts.reduce((acc, part) => acc[part] = acc[part] || {}, obj);
    target[last] = value;
  }

  get(key: StoreKey, defaultValue?: any): any {
    const value = this.getNestedValue(this.data, key);
    return value === undefined ? defaultValue : value;
  }

  set(key: StoreKey, value: any): boolean {
    try {
      this.setNestedValue(this.data, key, value);
      this.emitter.emit('change', key, value);
      this.isDirty = true;  // 标记数据已修改
      this.saveToFile();    // 立即保存修改
      return true;
    } catch (error) {
      console.error('Error setting store value:', error);
      return false;
    }
  }

  delete(key: StoreKey): void {
    this.setNestedValue(this.data, key, undefined);
    this.emitter.emit('change', key, undefined);
    this.saveToFile(); // 当数据变化时保存到文件
  }

  clear(): void {
    this.data = {
      clipboardHistory: [] as ClipboardItem[],
      settings: {
        shortcut: isMac ? 'Command+Shift+V' : 'Ctrl+Shift+V',
        retentionPeriod: 30,
        retentionUnit: 'days'
      }
    };
    this.emitter.emit('clear');
    this.saveToFile(); // 当数据变化时保存到文件
  }

  onDidChange(key: StoreKey, callback: (newValue: any, oldValue: any) => void): () => void {
    const handler = (changedKey: StoreKey, newValue: any) => {
      if (changedKey === key) {
        callback(newValue, this.get(key));
      }
    };
    this.emitter.on('change', handler);
    return () => this.emitter.off('change', handler);
  }
}

// 7. Store 初始化
let store: IStore;

try {
  const data: StoreSchema = {
    clipboardHistory: [] as ClipboardItem[],
    settings: {
      shortcut: isMac ? 'Command+Shift+V' : 'Ctrl+Shift+V',
      retentionPeriod: 30,
      retentionUnit: 'days'
    }
  };

  store = new BackupStore(data, app.getPath('userData'));
} catch (error) {
  console.error('Failed to initialize store:', error);
  
  const defaultSettings: StoreSchema['settings'] = {
    shortcut: isMac ? 'Command+Shift+V' : 'Ctrl+Shift+V',
    retentionPeriod: 30,
    retentionUnit: 'days'
  };

  const backupStore: StoreSchema = {
    clipboardHistory: [] as ClipboardItem[],
    settings: defaultSettings
  };

  store = new BackupStore(backupStore, app.getPath('userData'));
}

// 打印存储路径
log('Store path:', store.path);

// Debug: 打印初始配置
log('Initial store settings:', JSON.stringify(store.get('settings'), null, 2));

// 监听设置变化
store.onDidChange('settings', (newValue, oldValue) => {
  log('Settings changed:', 
    '\nOld:', JSON.stringify(oldValue, null, 2),
    '\nNew:', JSON.stringify(newValue, null, 2)
  );
});

function getImageMetadata(dataUrl: string): { width: number; height: number; size: number } {
  const img = nativeImage.createFromDataURL(dataUrl)
  const size = Buffer.from(dataUrl.split(',')[1], 'base64').length
  const { width, height } = img.getSize()
  
  return {
    width,
    height,
    size
  }
}

// 修改 ShortcutManager 类
const shortcutManager = {
  defaultShortcut: isMac ? 'Command+Shift+V' : 'Ctrl+Shift+V',
  currentShortcut: '',

  register(shortcut: string): boolean {
    try {
      // 先注销之前的快捷键
      if (this.currentShortcut) {
        globalShortcut.unregister(this.currentShortcut);
      }

      // 注册新快捷键
      const success = globalShortcut.register(shortcut, async () => {
        log('Shortcut triggered:', shortcut);
        if (historyWindow) {
          if (historyWindow.isVisible()) {
            historyWindow.hide();
          } else {
            historyWindow.show();
            historyWindow.focus();
          }
        } else {
          await createHistoryWindow();
        }
      });

      if (success) {
        this.currentShortcut = shortcut;
        log('Shortcut registered successfully:', shortcut);
      } else {
        log('Failed to register shortcut:', shortcut);
      }

      return success;
    } catch (error) {
      log('Error registering shortcut:', error);
      return false;
    }
  },

  unregisterAll() {
    globalShortcut.unregisterAll();
    this.currentShortcut = '';
  }
};

// 创建一个函数来处理所有与 Store 相关的 IPC 通信
function registerStoreHandlers() {
  // 获取存储值
  ipcMain.handle('store-get', (_, key: string) => {
    return store.get(key);
  });

  // 设置存储值
  ipcMain.handle('store-set', (_, key: string, value: any) => {
    store.set(key, value);
    return true;
  });

  // 删除存储值
  ipcMain.handle('store-delete', (_, key: 'clipboardHistory' | 'settings') => {
    store.delete(key);
    return true;
  });

  // 清空存储
  ipcMain.handle('store-clear', () => {
    store.clear();
    return true;
  });

  // 获取存储路径
  ipcMain.handle('store-path', () => {
    return store.path;
  });
}

// 添加一个 Map 来存储正在执行的同步进程
const syncProcesses = new Map<string, ChildProcess>();

// 在 registerIpcHandlers 函数内修改 sync-data 处理程序
function registerIpcHandlers() {
  // 获取剪贴板历史
  ipcMain.handle('get-clipboard-history', () => {
    return store.get('clipboardHistory', [])
  })

  // 处理保存到剪贴板
  ipcMain.handle('save-to-clipboard', (_, item: ClipboardItem) => {
    try {
      if (item.type === 'image') {
        const image = nativeImage.createFromDataURL(item.content);
        clipboard.writeImage(image);
      } else {
        clipboard.writeText(item.content);
      }
      return true;
    } catch (error) {
      console.error('Error saving to clipboard:', error);
      return false;
    }
  })

  // 从历史记录中删除
  ipcMain.handle('remove-from-history', async (_, id: string) => {
    try {
      const history = store.get('clipboardHistory', []) as ClipboardItem[]
      const newHistory = history.filter(item => item.id !== id)
      await store.set('clipboardHistory', newHistory)
      console.log('removeFromHistory success, new length:', newHistory.length);
      return true
    } catch (error) {
      console.error('Error removing from history:', error);
      return false
    }
  })

  // 切换收藏状态
  ipcMain.handle('toggle-favorite', (_, id: string) => {
    const history = store.get('clipboardHistory', []) as ClipboardItem[]
    const newHistory = history.map(item => 
      item.id === id ? { ...item, favorite: !item.favorite } : item
    )
    store.set('clipboardHistory', newHistory)
    return true
  })
  
  // 关闭历史窗口
  ipcMain.handle('close-history-window', () => {
    if (historyWindow) {
      historyWindow.hide()
    }
  })
  
  // 通用的获取存储值的处理程序
  ipcMain.handle('get-store-value', (_, key: string) => {
    try {
      const value = store.get(`settings.${key}`);
      log(`Getting store value for ${key}:`, value);
      return value;
    } catch (error) {
      log(`Error getting store value for ${key}:`, error);
      return undefined;
    }
  });

  // 通用的设置存储值的处理程序
  ipcMain.handle('set-store-value', (_, key: string, value: any) => {
    try {
      store.set(`settings.${key}`, value);
      log(`Setting store value for ${key}:`, value);
      return true;
    } catch (error) {
      log(`Error setting store value for ${key}:`, error);
      return false;
    }
  });

  // 获取历史记录文件路径
  ipcMain.handle('get-history-file-path', () => {
    const localPath = app.getPath('userData');
    const localFile = path.join(localPath, historyFileName);
    return localFile;
  });

  // 修改同步数据到云端的处理程序
  ipcMain.handle('sync-data', async (event, rcloneConfig: string, processId: string) => {
    if (!rcloneConfig) {
      throw new Error('请提供 Rclone 配置');
    }

    await store.set('settings.rcloneConfig', rcloneConfig);
    log('Saved Rclone config:', rcloneConfig);
    
    const localPath = app.getPath('userData');
    const localFile = path.join(localPath, historyFileName);

    try {
      // 确保本地数据文件存在
      if (!fs.existsSync(localFile)) {
        const initialData: ClipboardHistory = {
          clipboardHistory: store.get('clipboardHistory', []) as ClipboardItem[]
        };
        await fs.promises.mkdir(path.dirname(localFile), { recursive: true });
        await fs.promises.writeFile(localFile, JSON.stringify(initialData, null, 2));
      }

      // 验证文件是否可读
      try {
        await fs.promises.access(localFile, fs.constants.R_OK);
      } catch (error) {
        log('sync-data access error:', error);
        throw new Error('无法读取本地数据文件，请检查文件权限');
      }

      // 构建命令
      const command = ['copy', localFile, rcloneConfig, '-P', '--progress'];
      
      // 创建用于显示的命令字符串，使用引号包裹包含空格的路径
      const displayCommand = command.map(arg => 
        arg.includes(' ') ? `"${arg}"` : arg
      ).join(' ');

      const rcloneProcess = createSyncProcess(
        command,
        event,
        processId,
        `rclone ${displayCommand}`
      );
      
      syncProcesses.set(processId, rcloneProcess);

      // 返回 Promise
      return new Promise((resolve, reject) => {
        rcloneProcess.on('close', (code) => {
          if (syncProcesses.has(processId)) {  // 检查进程是否还存在
            syncProcesses.delete(processId);
            if (code === 0) {
              event.sender.send('sync-progress', { 
                processId, 
                data: '同步完成！'
              });
              resolve(true);
            } else {
              reject(new Error(`同步失败，退出码: ${code}`));
            }
          }
        });

        rcloneProcess.on('error', (error) => {
          if (syncProcesses.has(processId)) {  // 检查进程是否还存在
            syncProcesses.delete(processId);
            event.sender.send('sync-progress', { 
              processId, 
              data: `错误: ${error.message}`
            });
            reject(error);
          }
        });
      });

    } catch (error: any) {
      syncProcesses.delete(processId);
      if (error.code === 'ENOENT' && error.path === 'rclone') {
        throw new Error('未安装 rclone，请先安装 rclone 并配置远程存储');
      }
      throw new Error(`同步失败: ${error.message}`);
    }
  });

  // 修改取消同步的处理程序
  ipcMain.handle('cancel-sync', async (event, processId: string) => {
    const childProcess = syncProcesses.get(processId);
    if (childProcess) {
      try {
        if (process.platform === 'win32') {  // 使用全局的 process.platform
          await promisify(execFile)('taskkill', ['/pid', childProcess.pid.toString(), '/f', '/t']);
        } else {
          childProcess.kill();
        }
        
        if (syncProcesses.has(processId)) {
          event.sender.send('sync-progress', { 
            processId, 
            data: '同步操作已取消'
          });
          syncProcesses.delete(processId);
        }
        return true;
      } catch (error) {
        console.error('Error killing process:', error);
        return false;
      }
    }
    return false;
  });

  // 修改从云端同步数据到本地的处理程序
  ipcMain.handle('sync-data-from-cloud', async (event, rcloneConfig: string, processId: string) => {
    if (!rcloneConfig) {
      throw new Error('请提供 Rclone 配置');
    }

    const localPath = app.getPath('userData');
    const localFile = path.join(localPath, historyFileName);

    try {
      // 确保本地目录存在
      await fs.promises.mkdir(path.dirname(localFile), { recursive: true });

      // 构建命令
      const command = ['copy', rcloneConfig, localPath, '-P', '--progress'];
      
      // 创建用于显示的命令字符串，使用引号包裹包含空格的路径
      const displayCommand = command.map(arg => 
        arg.includes(' ') ? `"${arg}"` : arg
      ).join(' ');

      const rcloneProcess = createSyncProcess(
        command,
        event,
        processId,
        `rclone ${displayCommand}`
      );
      
      syncProcesses.set(processId, rcloneProcess);

      // 返回 Promise
      return new Promise((resolve, reject) => {
        rcloneProcess.on('close', async (code) => {
          if (syncProcesses.has(processId)) {  // 检查进程是否还存在
            syncProcesses.delete(processId);
            if (code === 0) {
              try {
                // 读取并验证同步的数据
                const data = await fs.promises.readFile(localFile, 'utf-8');
                const parsedData = JSON.parse(data);
                
                if (Array.isArray(parsedData.clipboardHistory)) {
                  store.set('clipboardHistory', parsedData.clipboardHistory);
                  event.sender.send('sync-progress', { 
                    processId, 
                    data: '同步完成！'
                  });
                  resolve(true);
                } else {
                  throw new Error('同步的数据格式无效');
                }
              } catch (parseError) {
                reject(new Error('无法解析同步的数据，可能是文件格式错误'));
              }
            } else {
              reject(new Error(`同步失败，退出码: ${code}`));
            }
          }
        });

        rcloneProcess.on('error', (error) => {
          if (syncProcesses.has(processId)) {  // 检查进程是否还存在
            syncProcesses.delete(processId);
            event.sender.send('sync-progress', { 
              processId, 
              data: `错误: ${error.message}`
            });
            reject(error);
          }
        });
      });

    } catch (error: any) {
      syncProcesses.delete(processId);
      if (error.code === 'ENOENT' && error.path === 'rclone') {
        throw new Error('未安装 rclone，请先安装 rclone 并配置远程存储');
      }
      throw new Error(`同步失败: ${error.message}`);
    }
  });

  // 打开存储目录
  ipcMain.handle('open-store-directory', () => {
    const localPath = app.getPath('userData');
    shell.openPath(localPath);
  });

  // 添加打开设置窗口的处理程序
  ipcMain.handle('open-settings-window', async () => {
    log('======open settings window=======');
    try {
      await createSettingWindow();
      return true;
    } catch (error) {
      console.error('Error opening settings window:', error);
      return false;
    }
  });

  // 添加关闭设置窗口的处理程序
  ipcMain.handle('close-settings-window', () => {
    if (settingWindow) {
      settingWindow.hide();
    }
    return true;
  });

  // 注册 Store 相关的处理程序
  registerStoreHandlers();
}

// 广播剪贴板变化到所有窗口
function broadcastClipboardChange(item: ClipboardItem) {
  if (settingWindow) {
    settingWindow.webContents.send('clipboard-change', item);
  }
  if (historyWindow) {
    historyWindow.webContents.send('clipboard-change', item);
  }
}

// 添加窗口尺寸常量
const WINDOW_SIZES = {
  settings: {
    width: 600,
    height: 400
  },
  history: {
    width: 500,
    height: 600
  }
} as const;

// 创建一个通用的窗口创建函数
async function createAppWindow(options: {
  width: number;
  height: number;
  isHistory?: boolean;
  hash?: string;
}) {
  const { width, height, isHistory = false, hash = '' } = options;
  log(`Creating ${isHistory ? 'history' : 'settings'} window...`);
  
  // 选择要操作的窗口引用
  let windowRef = isHistory ? historyWindow : settingWindow;
  
  // 如果窗口已存在且没有被销毁
  if (windowRef && !windowRef.isDestroyed()) {
    windowRef.show();
    windowRef.focus();
    
    // 如果有指定的 hash，更新窗口的 URL
    if (hash) {
      const isDev = process.env.NODE_ENV === 'development';
      const url = isDev ? 
        `http://localhost:5173/#${hash}` : 
        `file://${path.join(__dirname, '../dist/index.html')}#${hash}`;
      
      await windowRef.loadURL(url);
    }
    
    return;
  }

  // 创建新窗口
  const win = new BrowserWindow({
    width,
    height,
    icon: path.join(__dirname, '../public/icons/logo_dock.png'),
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
      sandbox: false,
    },
    ...(isHistory ? {
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      vibrancy: 'menu',
      visualEffectState: 'active',
      roundedCorners: true,
    } : {})
  });

  // 设置窗口引用
  if (isHistory) {
    historyWindow = win;
  } else {
    settingWindow = win;
  }

  try {
    const isDev = process.env.NODE_ENV === 'development';
    const url = isDev 
      ? `http://localhost:5173${hash ? `/#${hash}` : ''}`
      : `file://${path.join(__dirname, '../dist/index.html')}${hash ? `#${hash}` : ''}`;

    log('Loading URL:', url);
    await win.loadURL(url);

    // 设置窗口事件监听
    if (isHistory) {
      setupHistoryWindowEvents(win);
    } else {
      setupSettingWindowEvents(win);
    }

    // 等待内容加载完成后再显示窗口
    win.once('ready-to-show', () => {
      log('Window ready to show');
      win.show();
      win.focus();
      if (isHistory) {
        setTimeout(() => win.setAlwaysOnTop(false), 300);
      }
    });

  } catch (error) {
    console.error(`Error loading ${isHistory ? 'history' : 'settings'} window:`, error);
    throw error;
  }
}

// 设置历史窗口的事件监听
function setupHistoryWindowEvents(win: BrowserWindow) {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && !input.alt && !input.control && !input.shift && !input.meta) {
      win.hide();
    }
  });

  win.on('hide', () => {
    // 确保窗口完全隐藏后再注册快捷键
    // setImmediate(() => {
    //   const settings = store.get('settings') as StoreSchema['settings'];
    //   const shortcut = settings?.shortcut || shortcutManager.defaultShortcut;
    //   shortcutManager.register(shortcut);
    // });
  });

  win.on('blur', () => {
    if (!win.webContents.isDevToolsOpened()) {
      win.hide();
    }
  });

  win.on('closed', () => {
    historyWindow = null;
    // 确保窗口完全关闭后再注册快捷键
    // setImmediate(() => {
    //   const settings = store.get('settings') as StoreSchema['settings'];
    //   const shortcut = settings?.shortcut || shortcutManager.defaultShortcut;
    //   shortcutManager.register(shortcut);
    // });
  });
}

// 设置主窗口的事件监听
function setupSettingWindowEvents(win: BrowserWindow) {
  win.on('closed', () => {
    log('Setting window closed');
    settingWindow = null;
  });

  win.on('close', (event) => {
    if (!isQuitting) {  // 使用我们自己的 isQuitting 变量，而不是 app.isQuitting
      event.preventDefault();
      win.hide();
      log('Setting window hidden');
    }
  });
}

// 修改原有的创建窗口函数
async function createSettingWindow() {
  await createAppWindow({
    ...WINDOW_SIZES.settings,
    hash: '/settings'
  });
}

async function createHistoryWindow() {
  await createAppWindow({
    ...WINDOW_SIZES.history,
    isHistory: true
  });
}

// 创建托盘图标
function createTrayIcon(): Tray {
  log('createTrayIcon');
  let iconPath: string;
  
  if (app.isPackaged) {
    // 在打包的应用中使用 process.resourcesPath
    iconPath = path.join(process.resourcesPath, 'icons/logo_tray_Template.png');
  } else {
    // 在开发环境中使用项目目录
    iconPath = path.join(__dirname, '../public/icons/logo_tray_Template@2x.png');
  }

  log('App path:', app.getAppPath());
  log('Is packaged:', app.isPackaged);
  log('Resource path:', process.resourcesPath);
  log('Tray icon path:', iconPath);

  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    log('Error: Failed to load tray icon from path:', iconPath);
  } else {
    log('Success: Icon loaded successfully');
  }

  const tray = new Tray(icon);
  tray.setToolTip('ClipHarbor');
  contextMenu = contextMenu || createContextMenu();
  tray.setContextMenu(contextMenu);
  return tray;
}

// 创建 Dock 图标
function createDockIcon() {
  if (isMac) {
    try {
      const dockIconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'icons/logo_dock.png')
        : path.join(__dirname, '../public/icons/logo_dock.png');
      
      log('Setting dock icon:', dockIconPath);
      app.dock.setIcon(dockIconPath);
      // app.dock.setMenu(Menu.buildFromTemplate([
      //   {
      //     label: '退出',
      //     click: () => {
      //       isQuitting = true;
      //       app.quit();
      //     }
      //   }
      // ]));
    } catch (dockError) {
      log('Error setting dock icon:', dockError);
    }
  }
}

// 创建托盘菜单
function createContextMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '打开设置',
      click: async () => {
        await createSettingWindow();
      }
    },
    {
      label: '退出',
      click: () => {
        isQuitting = true;  // 设置退出标志
        app.quit();
      }
    }
  ];
  return Menu.buildFromTemplate(template);
}

// 开始监听剪贴板变化
function startClipboardMonitoring() {
  console.log('Starting clipboard monitoring...');
  let lastContent = '';
  let lastImage = '';

  // 每秒检查一次剪贴板变化
  global.clipboardInterval = setInterval(() => {
    try {
      // 检查是否有文件
      // const filePaths = clipboard.readBuffer('FileNameW');
      // console.log('filePaths', filePaths.length);
      // if (filePaths.length > 0) {
      //   console.log('filePaths.has.length');
      //   try {
      //     const files = clipboard.readBuffer('FileNameW').toString('ucs2').replace(/\\/g, '/').split('\0').filter(Boolean);
      //     if (files.length > 0 && files.join(',') !== lastContent) {
      //       lastContent = files.join(',');
      //       const history = store.get('clipboardHistory', []) as ClipboardItem[];
      //       const newItem: ClipboardItem = {
      //         id: uuidv4(),
      //         content: files.join(','),
      //         type: 'text',
      //         timestamp: Date.now(),
      //         favorite: false
      //       }
      //       const newHistory = [newItem, ...history.filter(item => item.content !== newItem.content)];
      //       store.set('clipboardHistory', newHistory);
      //       broadcastClipboardChange(newItem);
      //     }
      //   } catch (error) {
      //     console.error('Error processing file paths:', error);
      //   }
      //   return;
      // }

      // 检查是否有图片
      const image = clipboard.readImage();
      // console.log(new Date().toISOString(), 'image.isEmpty()', image.isEmpty());
      if (!image.isEmpty()) {
        const dataUrl = image.toDataURL();
        if (dataUrl !== lastImage) {
          lastImage = dataUrl;
          const metadata = getImageMetadata(dataUrl);
          const history = store.get('clipboardHistory', []) as ClipboardItem[];
          const newItem: ClipboardItem = {
            id: uuidv4(),
            content: dataUrl,
            type: 'image',
            timestamp: Date.now(),
            favorite: false,
            metadata
          }
          const newHistory = [newItem, ...history.filter(i => i.content !== dataUrl)];
          store.set('clipboardHistory', newHistory);
          broadcastClipboardChange(newItem);
        }
      } else {
        // 检查文本内容
        const text = clipboard.readText();
        // console.log(new Date().toISOString(), 'text.content', text);
        if (text && text !== lastContent) {
          console.log('save text');
          lastContent = text;
          const history = store.get('clipboardHistory', []) as ClipboardItem[];
          const newItem: ClipboardItem = {
            id: uuidv4(),
            content: text,
            type: 'text',
            timestamp: Date.now(),
            favorite: false
          }
          const newHistory = [newItem, ...history.filter(i => i.content !== newItem.content)];
          store.set('clipboardHistory', newHistory);
          broadcastClipboardChange(newItem);
        }
      }
    } catch (error) {
      console.error('Error reading clipboard:', error);
    }
  }, 1000);

  console.log('Clipboard monitoring started');
}

app.whenReady().then(async () => {
  try {
    log('App is ready, initializing...');
    log('Resource path:', process.resourcesPath);
    log('App path:', app.getAppPath());
    log('Current directory:', __dirname);
    
    // 注册 IPC 处理程序
    registerIpcHandlers();

    // 创建 Dock 图标
    // createDockIcon();

    // 隐藏dock图标
    app.dock.hide();

    // 立即创建并显示设置窗口
    log('Creating settings window...');
    await createSettingWindow();
    
    try {
      // 创建托盘图标
      log('Creating tray icon...');
      createTrayIcon();
    } catch (trayError) {
      log('Error creating tray icon:', trayError);
    }

    try {
      // 开始监听剪贴板
      log('Starting clipboard monitoring...');
      startClipboardMonitoring();
    } catch (clipboardError) {
      log('Error starting clipboard monitoring:', clipboardError);
    }

    try {
      // 注册快捷键
      log('Registering shortcuts...');
      const settings = store.get('settings') as StoreSchema['settings'];
      const shortcut = settings?.shortcut || shortcutManager.defaultShortcut;
      const registered = shortcutManager.register(shortcut);
      
      if (!registered) {
        log('Failed to register initial shortcut, trying default shortcut');
        shortcutManager.register(shortcutManager.defaultShortcut);
      }
    } catch (shortcutError) {
      log('Error registering shortcuts:', shortcutError);
    }

    // 设置事件监听器
    app.on('activate', async () => {
      log('App activated from dock');
      if (settingWindow) {
        settingWindow.show();
        settingWindow.focus();
      } else {
        await createSettingWindow();
      }
    });

    app.on('will-quit', () => {
      log('App will quit, unregistering shortcuts');
      globalShortcut.unregisterAll();
    });

    app.on('before-quit', () => {
      log('App is quitting...');
      isQuitting = true;
      
      if (global.clipboardInterval) {
        clearInterval(global.clipboardInterval);
      }
      
      BrowserWindow.getAllWindows().forEach(window => {
        window.destroy();
      });
      
      settingWindow = null;
      historyWindow = null;
    });

  } catch (error) {
    // 更详细的错误日志
    log('Error during app initialization:');
    log('Error name:', error?.name);
    log('Error message:', error?.message);
    log('Error stack:', error?.stack);
    if (error instanceof Error) {
      log('Full error object:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...error
      });
    } else {
      log('Non-Error object thrown:', error);
    }
    console.error('Error during app initialization:', error);
  }
});

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit();
  }
});

ipcMain.handle('open-external', async (_, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// 修改同步处理程序中的进程管理
function createSyncProcess(
  command: string[], 
  event: Electron.IpcMainInvokeEvent, 
  processId: string,
  commandString: string
) {
  // 首先发送命令信息
  event.sender.send('sync-progress', { 
    processId, 
    data: `正在执行命令: ${commandString}`
  });

  try {
    // 使用引号包裹包含空格的路径
    const quotedCommand = command.map(arg => 
      arg.includes(' ') ? `"${arg}"` : arg
    );

    const rcloneProcess = spawn('rclone', quotedCommand, {
      shell: true,  // 使用 shell 来处理命令
      stdio: ['pipe', 'pipe', 'pipe']  // 确保所有输出都被捕获
    });
    
    let isTerminated = false;
    let errorOutput = '';
    let stdoutBuffer = '';
    let stderrBuffer = '';

    // 处理标准输出
    rcloneProcess.stdout.on('data', (data: Buffer) => {
      if (!isTerminated) {
        const output = data.toString();
        stdoutBuffer += output;
        
        // 按行处理输出，添加类型注解
        const lines = output.split('\n');
        lines.forEach((line: string) => {
          if (line.trim()) {
            event.sender.send('sync-progress', { 
              processId, 
              data: line.trim()
            });
          }
        });
      }
    });

    // 处理标准错误
    rcloneProcess.stderr.on('data', (data: Buffer) => {
      if (!isTerminated) {
        const output = data.toString();
        stderrBuffer += output;
        errorOutput += output;

        // 按行处理错误输出，添加类型注解
        const lines = output.split('\n');
        lines.forEach((line: string) => {
          if (line.trim()) {
            event.sender.send('sync-progress', { 
              processId, 
              data: `错误: ${line.trim()}`
            });
          }
        });
      }
    });

    // 处理进程退出
    rcloneProcess.on('exit', (code, signal) => {
      isTerminated = true;
      if (syncProcesses.has(processId)) {
        syncProcesses.delete(processId);

        // 确保所有缓冲的输出都被处理
        if (code !== 0) {
          // 如果有错误输出，显示完整的错误信息
          if (errorOutput) {
            event.sender.send('sync-progress', { 
              processId, 
              data: `命令执行失败 (退出码: ${code})${signal ? `, 信号: ${signal}` : ''}`
            });
          }
        } else {
          // 如果成功，显示成功消息
          event.sender.send('sync-progress', { 
            processId, 
            data: '命令执行成功'
          });
        }
      }
    });

    // 处理进程错误（比如命令不存在）
    rcloneProcess.on('error', (error) => {
      if (syncProcesses.has(processId)) {
        event.sender.send('sync-progress', { 
          processId, 
          data: `进程错误: ${error.message}`
        });
        syncProcesses.delete(processId);
      }
    });

    // 如果进程没有立即退出，发送开始执行的消息
    if (rcloneProcess.pid) {
      event.sender.send('sync-progress', { 
        processId, 
        data: `进程已启动 (PID: ${rcloneProcess.pid})`
      });
    }

    return rcloneProcess;
  } catch (error) {
    // 处理进程创建失败的情况
    event.sender.send('sync-progress', { 
      processId, 
      data: `启动进程失败: ${error.message}`
    });
    throw error;
  }
}
