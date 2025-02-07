import { app, BrowserWindow, clipboard, ipcMain, nativeImage, globalShortcut, Tray, Menu, shell, screen, desktopCapturer } from 'electron';
import path from 'path';
import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { ClipboardItem } from '../src/types';

declare global {
  var clipboardInterval: NodeJS.Timeout | undefined;
}

const store = new Store({
  name: 'clipboard-history',
  defaults: {
    clipboardHistory: [],
    settings: {
      shortcut: process.platform === 'darwin' ? 'Command+Shift+V' : 'Ctrl+Shift+V',
      showDockIcon: true,
      showTrayIcon: true,
      retentionPeriod: 30,
      retentionUnit: 'days',
      autoHideHistory: true // 新增自动隐藏设置
    }
  },
  clearInvalidConfig: false, // 不清除无效配置
  watch: true // 监听配置变化
});

// 打印存储路径
log('Store path:', store.path);

const historyFileName = 'clipboard-history.json';

// 创建日志函数
function log(...args: any[]) {
  const time = new Date().toISOString();
  console.log(`[${time}]`, ...args);
}

// 创建 IPC 日志函数
function ipcLog(...args: any[]) {
  const time = new Date().toISOString();
  console.log(`[${time}]`, ...args);
  if (mainWindow) {
    mainWindow.webContents.send('log', `[${time}] ${args.join(' ')}`);
  }
}

// Debug: 打印初始配置
log('Initial store settings:', JSON.stringify(store.get('settings'), null, 2));

// 监听设置变化
store.onDidChange('settings', (newValue, oldValue) => {
  log('Settings changed:', 
    '\nOld:', JSON.stringify(oldValue, null, 2),
    '\nNew:', JSON.stringify(newValue, null, 2)
  );
});

const __dirname = path.dirname(__filename)

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

let mainWindow: BrowserWindow | null = null
let historyWindow: BrowserWindow | null = null
let tray: Tray | null = null;

// 注册快捷键处理函数
function registerShortcutHandler() {
  return async () => {
    console.log('触发快捷键');
    
    // 如果窗口可见则隐藏
    if (historyWindow?.isVisible()) {
      console.log('历史窗口可见，隐藏它');
      historyWindow.hide();
      return;
    }
    
    console.log('显示历史窗口');
    
    // 如果窗口不存在则创建
    if (!historyWindow) {
      console.log('创建新的历史窗口');
      await createHistoryWindow();
    }

    // 获取鼠标位置
    const mousePoint = screen.getCursorScreenPoint();
    // 获取鼠标所在的显示器
    const display = screen.getDisplayNearestPoint(mousePoint);
    
    // 计算窗口位置，使其显示在鼠标位置的正下方
    const windowBounds = historyWindow!.getBounds();
    let x = mousePoint.x - windowBounds.width / 2;
    let y = mousePoint.y + 10; // 在鼠标下方10像素处显示

    // 确保窗口不会超出显示器边界
    x = Math.max(display.bounds.x, Math.min(x, display.bounds.x + display.bounds.width - windowBounds.width));
    y = Math.max(display.bounds.y, Math.min(y, display.bounds.y + display.bounds.height - windowBounds.height));

    // 禁用自动隐藏
    historyWindow!.removeAllListeners('blur');
    
    // 在 macOS 上特殊处理
    if (process.platform === 'darwin') {
      console.log('设置窗口在所有工作区可见');
      historyWindow!.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true
      });
    }

    // 设置窗口位置并显示
    historyWindow!.setBounds({
      x: Math.round(x),
      y: Math.round(y),
      width: windowBounds.width,
      height: windowBounds.height
    });

    // 显示窗口前先激活应用
    app.focus({ steal: true });

    // 等待一帧以确保位置设置生效
    setTimeout(() => {
      if (historyWindow) {
        // 显示窗口并立即设置焦点
        historyWindow.showInactive();
        historyWindow.focus();

        // 延迟重新绑定blur事件
        setTimeout(() => {
          if (historyWindow) {
            console.log('重新绑定blur事件');
            if (process.platform === 'darwin') {
              historyWindow.setVisibleOnAllWorkspaces(false);
            }

            // 使用一个标志来跟踪是否正在处理blur事件
            let isProcessingBlur = false;

            historyWindow.on('blur', () => {
              // 如果正在处理blur事件，直接返回
              if (isProcessingBlur) {
                return;
              }

              console.log('历史窗口失去焦点');
              const autoHide = store.get('settings.autoHideHistory', true);
              if (autoHide && historyWindow && !historyWindow.webContents.isDevToolsOpened()) {
                isProcessingBlur = true;

                // 给一个短暂的延迟，让窗口有机会重新获得焦点
                setTimeout(() => {
                  const focusedWindow = BrowserWindow.getFocusedWindow();
                  console.log('当前焦点窗口:', focusedWindow?.id);
                  console.log('主窗口:', mainWindow?.id);
                  console.log('历史窗口:', historyWindow?.id);

                  // 只有在确实失去焦点时才隐藏窗口
                  if (!historyWindow?.isFocused() && focusedWindow !== mainWindow) {
                    console.log('由于失去焦点隐藏历史窗口');
                    historyWindow?.hide();
                  } else {
                    console.log('窗口仍然有焦点，不隐藏');
                  }

                  isProcessingBlur = false;
                }, 100);
              }
            });
          }
        }, 200);
      }
    }, 16); // 大约一帧的时间
  };
}

// 注册所有的 IPC 处理程序
function registerIpcHandlers() {
  // 获取剪贴板历史
  ipcMain.handle('get-clipboard-history', () => {
    return store.get('clipboardHistory', [])
  })

  // 处理 Dock 显示设置
  ipcMain.handle('toggle-dock-icon', (_, show: boolean) => {
    if (process.platform === 'darwin') {
      if (show) {
        app.dock.show().then(() => {
          // 显示后重新设置图标
          app.dock.setIcon(path.join(__dirname, '../public/logo_dock.png'));
        });
      } else {
        app.dock.hide();
      }
    }
    store.set('settings.showDockIcon', show);
    return show;
  });

  // 处理状态栏图标显示设置
  ipcMain.handle('toggle-tray-icon', (_, show: boolean) => {
    if (show && !tray) {
      tray = new Tray(path.join(__dirname, '../public/logo_tray.png'));
      const contextMenu = Menu.buildFromTemplate([
        { label: 'Show App', click: () => { mainWindow?.show(); } },
        { label: 'Quit', click: () => { app.quit(); } }
      ]);
      tray.setToolTip('ClipHarbor');
      tray.setContextMenu(contextMenu);
    } else if (!show && tray) {
      tray.destroy();
      tray = null;
    }
    store.set('settings.showTrayIcon', show);
    return show;
  });

  // 保存到剪贴板
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
  ipcMain.handle('remove-from-history', (_, id: string) => {
    const history = store.get('clipboardHistory', []) as ClipboardItem[]
    const newHistory = history.filter(item => item.id !== id)
    store.set('clipboardHistory', newHistory)
    return true
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

  // 切换 Dock 显示
  ipcMain.handle('toggle-dock', async (_, show: boolean) => {
    if (process.platform === 'darwin') {
      if (show) {
        app.dock.show();
      } else {
        app.dock.hide();
      }
    }
    store.set('settings.showDockIcon', show);
    return true;
  });

  // 切换托盘图标显示
  ipcMain.handle('toggle-tray', async (_, show: boolean) => {
    if (tray) {
      tray.setVisible(show);
    }
    store.set('settings.showTrayIcon', show);
    return true;
  });

  const defaultShortcut = process.platform === 'darwin' ? 'Command+Shift+V' : 'Ctrl+Shift+V';
  
  // 获取设置的快捷键
  ipcMain.handle('get-shortcut', () => {
    log('Getting current shortcut');
    const settings = store.get('settings');
    const shortcut = settings?.shortcut || defaultShortcut;
    log('Current shortcut:', shortcut);
    return shortcut;
  })

  // 处理设置快捷键
  ipcMain.handle('set-shortcut', async (_, shortcut: string) => {
    try {
      log('Setting new shortcut:', shortcut);
      
      // 先注销所有快捷键
      log('Unregistering all shortcuts');
      globalShortcut.unregisterAll();
      
      if (shortcut === '') {
        return false;
      }
      // 注册新的快捷键
      log('Registering new shortcut:', shortcut);
      const success = globalShortcut.register(shortcut, registerShortcutHandler());
      log('New shortcut registration success:', success);
      
      // 检查快捷键是否已注册
      log('Checking if new shortcut is registered');
      const isRegistered = globalShortcut.isRegistered(shortcut);
      log('Is new shortcut registered?', shortcut, ':', isRegistered);

      if (!success) {
        log('Failed to register new shortcut, reverting to default');
        // 如果注册失败，重新注册默认快捷键
        log('Registering default shortcut:', defaultShortcut);
        const registered = globalShortcut.register(defaultShortcut, registerShortcutHandler());
        log('Default shortcut registration:', registered);
        
        store.set('settings', {
          ...store.get('settings'),
          shortcut: defaultShortcut
        });
        return false;
      }

      // 保存新的快捷键
      log('Saving new shortcut');
      const currentSettings = store.get('settings') || {};
      const newSettings = {
        ...currentSettings,
        shortcut: shortcut
      };
      store.set('settings', newSettings);
      
      log('New settings saved:', store.get('settings'));
      return true;
    } catch (error) {
      log('Error setting shortcut:', error);
      // 如果出错，重新注册默认快捷键
      log('Registering default shortcut:', defaultShortcut);
      globalShortcut.register(defaultShortcut, registerShortcutHandler());
      store.set('settings', {
        ...store.get('settings'),
        shortcut: defaultShortcut
      });
      return false;
    }
  });

  // 关闭历史窗口
  ipcMain.handle('close-history-window', () => {
    if (historyWindow) {
      historyWindow.hide()
    }
  })

  // 处理注销快捷键的 IPC 请求
  ipcMain.on('unregister-shortcut', () => {
    globalShortcut.unregisterAll();
    console.log('All shortcuts unregistered');
  });

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

  // 同步数据到云端
  ipcMain.handle('sync-data', async (event, rcloneConfig: string) => {
    if (!rcloneConfig) {
      throw new Error('请提供 Rclone 配置');
    }

    // 保存配置
    await store.set('settings.rcloneConfig', rcloneConfig);
    log('Saved Rclone config:', rcloneConfig);
    const execFileAsync = promisify(execFile);
    const localPath = app.getPath('userData');
    const localFile = path.join(localPath, historyFileName);

    try {
      // 确保本地数据文件存在
      if (!fs.existsSync(localFile)) {
        // 如果文件不存在，创建一个包含空历史记录的文件
        const initialData = {
          clipboardHistory: store.get('clipboardHistory', [])
        };
        await fs.promises.mkdir(path.dirname(localFile), { recursive: true });
        await fs.promises.writeFile(localFile, JSON.stringify(initialData, null, 2));
      }

      // 验证文件是否可读
      try {
        await fs.promises.access(localFile, fs.constants.R_OK);
      } catch (error) {
        throw new Error('无法读取本地数据文件，请检查文件权限');
      }

      // 使用 rclone 复制文件到云端
      await execFileAsync('rclone', ['copy', localFile, rcloneConfig]);
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT' && error.path === 'rclone') {
        throw new Error('未安装 rclone，请先安装 rclone 并配置远程存储');
      }
      
      // 提供更详细的错误信息
      const errorMessage = error.message || '未知错误';
      if (errorMessage.includes('directory not found')) {
        throw new Error('本地数据文件不存在或无法访问，请确保应用有权限访问该目录');
      }
      throw new Error(`同步失败: ${errorMessage}`);
    }
  });

  // 从云端同步数据到本地
  ipcMain.handle('sync-data-from-cloud', async (event, rcloneConfig: string) => {
    if (!rcloneConfig) {
      throw new Error('请提供 Rclone 配置');
    }

    const execFileAsync = promisify(execFile);
    const localPath = app.getPath('userData');
    const localFile = path.join(localPath, historyFileName);

    try {
      // 确保本地目录存在
      await fs.promises.mkdir(path.dirname(localFile), { recursive: true });

      // 使用 rclone 从云端复制文件到本地
      await execFileAsync('rclone', ['copy', rcloneConfig, localPath]);
      
      try {
        // 读取并验证同步的数据
        const data = await fs.promises.readFile(localFile, 'utf-8');
        const parsedData = JSON.parse(data);
        
        if (Array.isArray(parsedData.clipboardHistory)) {
          store.set('clipboardHistory', parsedData.clipboardHistory);
        } else {
          throw new Error('同步的数据格式无效');
        }
      } catch (parseError) {
        throw new Error('无法解析同步的数据，可能是文件格式错误');
      }
      
      return true;
    } catch (error: any) {
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

  // 设置自动隐藏
  ipcMain.handle('set-auto-hide', (_, value: boolean) => {
    store.set('settings.autoHideHistory', value);
    return true;
  });

  // 获取自动隐藏设置
  ipcMain.handle('get-auto-hide', () => {
    return store.get('settings.autoHideHistory', true);
  });
}

// 注册快捷键
function registerShortcuts() {
  const defaultShortcut = process.platform === 'darwin' ? 'Command+Shift+V' : 'Ctrl+Shift+V';
  
  // Debug: 打印 store 中的所有数据
  // log('All store data:', JSON.stringify(store.store, null, 2));
  
  const settings = store.get('settings');
  log('Current settings:', JSON.stringify(settings, null, 2));
  
  const currentShortcut = settings?.shortcut || defaultShortcut;
  log('Using shortcut:', currentShortcut);
  
  // 注销所有已注册的快捷键
  log('Unregistering all shortcuts');
  globalShortcut.unregisterAll();
  
  try {
    // 注册保存的快捷键
    log('Registering shortcut:', currentShortcut);
    const success = globalShortcut.register(currentShortcut, registerShortcutHandler());
    log('Shortcut registration success:', success);
    
    // 检查快捷键是否已注册
    log('Checking if shortcut is registered');
    const isRegistered = globalShortcut.isRegistered(currentShortcut);
    log('Is shortcut registered?', currentShortcut, ':', isRegistered);
    
    // 如果注册失败，使用默认快捷键
    if (!success) {
      log('Failed to register saved shortcut, trying default:', defaultShortcut);
      log('Registering default shortcut:', defaultShortcut);
      const registered = globalShortcut.register(defaultShortcut, registerShortcutHandler());
      log('Default shortcut registration:', registered);
      
      if (registered) {
        const currentSettings = store.get('settings') || {};
        store.set('settings', {
          ...currentSettings,
          shortcut: defaultShortcut
        });
        log('Default shortcut registered and saved');
      } else {
        log('Failed to register default shortcut');
      }
    }
  } catch (error) {
    log('Error during shortcut registration:', error);
  }
}

// 存储当前快捷键
let currentShortcut = process.platform === 'darwin' ? 'Command+Shift+V' : 'Ctrl+Shift+V';

// 广播剪贴板变化到所有窗口
function broadcastClipboardChange(item: ClipboardItem) {
  if (mainWindow) {
    mainWindow.webContents.send('clipboard-change', item);
  }
  if (historyWindow) {
    historyWindow.webContents.send('clipboard-change', item);
  }
}

// 创建历史记录窗口
async function createHistoryWindow() {
  console.log('创建历史窗口...');

  // 如果窗口已存在，直接返回
  if (historyWindow) {
    return historyWindow;
  }

  // 创建新窗口
  historyWindow = new BrowserWindow({
    width: 600,
    height: 800,
    icon: path.join(__dirname, '../public/logo_dock.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    frame: false,  // 移除窗口边框
    transparent: true,  // 允许透明
    show: false,
    alwaysOnTop: true,
    vibrancy: 'menu',  // 添加毛玻璃效果（仅在 macOS 上生效）
    visualEffectState: 'active',  // 保持毛玻璃效果活跃（仅在 macOS 上生效）
    roundedCorners: true,  // 圆角窗口（仅在 macOS 上生效）
    focusable: true,  // 确保窗口可以获得焦点
  });

  console.log('加载历史窗口URL...');

  // 根据环境加载不同的URL
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';
  if (isDevelopment && !process.env.IS_TEST) {
    await historyWindow.loadURL('http://localhost:5173/#/history');
  } else {
    await historyWindow.loadFile('dist/index.html', {
      hash: 'history'
    });
  }

  let isClosing = false;

  // 添加焦点事件监听
  historyWindow.on('focus', () => {
    console.log('历史窗口获得焦点');
  });

  // 监听窗口失去焦点事件
  historyWindow.on('blur', () => {
    if (isClosing) {
      console.log('窗口正在关闭，忽略blur事件');
      return;
    }
    console.log('历史窗口失去焦点');
    // 获取自动隐藏设置
    const autoHide = store.get('settings.autoHideHistory', true); // 默认为 true
    if (autoHide && historyWindow && !historyWindow.webContents.isDevToolsOpened()) {
      // 检查是否是因为切换到了设置窗口
      const focusedWindow = BrowserWindow.getFocusedWindow();
      console.log('当前焦点窗口:', focusedWindow?.id);
      console.log('主窗口:', mainWindow?.id);
      if (focusedWindow !== mainWindow) {
        console.log('由于失去焦点隐藏历史窗口');
        isClosing = true;
        setTimeout(() => {
          historyWindow?.hide();
          isClosing = false;
        }, 100);
      }
    }
  });

  // 监听窗口显示事件
  historyWindow.on('show', () => {
    console.log('历史窗口显示');
  });

  // 监听窗口隐藏事件
  historyWindow.on('hide', () => {
    console.log('历史窗口隐藏');
  });

  // 监听窗口关闭事件
  historyWindow.on('closed', () => {
    console.log('历史窗口关闭');
    historyWindow = null;
  });

  // 添加 ESC 键监听
  historyWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && !input.alt && !input.control && !input.shift && !input.meta) {
      console.log('按下ESC键，隐藏历史窗口');
      historyWindow?.hide();
    }
  });

  return historyWindow;
}

// 创建主窗口（设置页面）
async function createWindow() {
  // 如果窗口已经存在但被隐藏，则重新创建
  if (mainWindow) {
    // 如果窗口已经被销毁或为 null，则重新创建
    if (mainWindow.isDestroyed() || mainWindow === null) {
      mainWindow = null;
    } else {
      // 如果窗口存在但隐藏，显示窗口
      mainWindow.show();
      mainWindow.focus();
      return;
    }
  }

  mainWindow = new BrowserWindow({
    width: 700,
    height: 480,
    icon: path.join(__dirname, '../public/logo_dock.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    }
  });

  try {
    // 在开发环境中，尝试连接到 Vite 开发服务器
    const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';
    if (isDev) {
      const devServerUrl = 'http://localhost:5173';
      console.log('Development mode - Loading URL:', devServerUrl);
      try {
        await mainWindow.loadURL(`${devServerUrl}/#/settings`);
        console.log('Successfully loaded dev server URL');
        // 开发环境下打开开发者工具
        mainWindow.webContents.openDevTools();
      } catch (error) {
        console.error('Failed to load dev server URL, falling back to file:', error);
        // 如果连接开发服务器失败，回退到加载本地文件
        const filePath = path.join(__dirname, '../dist/index.html');
        await mainWindow.loadFile(filePath, {
          hash: '/settings'
        });
      }
    } else {
      // 生产环境直接加载本地文件
      const filePath = path.join(__dirname, '../dist/index.html');
      console.log('Production mode - Loading file:', filePath);
      await mainWindow.loadFile(filePath, {
        hash: '/settings'
      });
    }
    console.log('URL loaded successfully');

    // 显示窗口
    mainWindow.show();
    mainWindow.focus();
  } catch (error) {
    console.error('Error loading main window:', error);
  }

  // 监听窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 监听窗口隐藏事件
  mainWindow.on('close', (event) => {
    event.preventDefault(); // 阻止默认关闭行为
    mainWindow?.hide(); // 隐藏窗口而不是关闭
  });
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
      const filePaths = clipboard.readBuffer('FileNameW');
      if (filePaths.length > 0) {
        try {
          const files = clipboard.readBuffer('FileNameW').toString('ucs2').replace(/\\/g, '/').split('\0').filter(Boolean);
          if (files.length > 0 && files.join(',') !== lastContent) {
            lastContent = files.join(',');
            const history = store.get('clipboardHistory', []) as ClipboardItem[];
            const newItem: ClipboardItem = {
              id: uuidv4(),
              content: files.join(','),
              type: 'file',
              timestamp: Date.now(),
              favorite: false
            }
            const newHistory = [newItem, ...history.filter(item => item.content !== newItem.content)];
            store.set('clipboardHistory', newHistory);
            broadcastClipboardChange(newItem);
          }
        } catch (error) {
          console.error('Error processing file paths:', error);
        }
        return;
      }

      // 检查是否有图片
      const image = clipboard.readImage();
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
        if (text && text !== lastContent) {
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
  console.log('App is ready, initializing...');
  
  // 注册 IPC 处理程序
  registerIpcHandlers();
  
  // 注册快捷键
  registerShortcuts();
  
  // 创建主窗口
  await createWindow();
  
  // 创建并隐藏历史窗口
  await createHistoryWindow();
  historyWindow?.hide();

  // 设置 Tray 图标
  tray = new Tray(path.join(__dirname, '../public/logo_tray.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => { mainWindow?.show(); } },
    { label: 'Quit', click: () => { app.quit(); } }
  ]);
  tray.setToolTip('ClipHarbor');
  tray.setContextMenu(contextMenu);
  
  // 开始监听剪贴板
  startClipboardMonitoring();
  
  if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, '../public/logo_dock.png'));
  }

  app.on('activate', async () => {
    if (!mainWindow) {
      await createWindow();
    } else {
      mainWindow.show();
    }
  });

  // 在应用退出前注销所有快捷键
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });

  // 当应用退出前，清理资源
  app.on('before-quit', () => {
    // 停止剪贴板监控
    if (global.clipboardInterval) {
      clearInterval(global.clipboardInterval);
    }
    
    // 关闭所有窗口
    BrowserWindow.getAllWindows().forEach(window => {
      window.destroy();
    });
    
    // 清理窗口引用
    mainWindow = null;
    historyWindow = null;
    tray = null;
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
