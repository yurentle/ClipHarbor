import { app, BrowserWindow, clipboard, ipcMain, nativeImage, globalShortcut, Tray, Menu } from 'electron';
import path from 'path';
import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';

declare global {
  var clipboardInterval: NodeJS.Timeout | undefined;
}

// 定义剪贴板项的类型
interface ClipboardItem {
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

const store = new Store({
  name: 'clipboard-history',
  defaults: {
    clipboardHistory: []
  }
})

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
          app.dock.setIcon(path.join(__dirname, '../public/logo.png'));
        });
      } else {
        app.dock.hide();
      }
    }
    return show;
  });

  // 处理状态栏图标显示设置
  ipcMain.handle('toggle-tray-icon', (_, show: boolean) => {
    if (show && !tray) {
      tray = new Tray(path.join(__dirname, '../public/16.png'));
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
    return show;
  });

  // 保存到剪贴板
  ipcMain.handle('save-to-clipboard', (_, item: ClipboardItem) => {
    if (item.type === 'image') {
      const image = clipboard.readImage().create(item.content)
      clipboard.writeImage(image)
    } else {
      clipboard.writeText(item.content)
    }
    return true
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
    return true;
  });

  // 切换托盘图标显示
  ipcMain.handle('toggle-tray', async (_, show: boolean) => {
    if (tray) {
      tray.setVisible(show);
    }
    return true;
  });

  // 获取默认快捷键
  ipcMain.handle('get-default-shortcut', () => {
    return process.platform === 'darwin' ? 'Command+Shift+V' : 'Ctrl+Shift+V'
  })

  // 关闭历史窗口
  ipcMain.handle('close-history-window', () => {
    if (historyWindow) {
      historyWindow.hide()
    }
  })
}

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
  console.log('Creating history window...');

  // 如果已经存在窗口，先销毁它
  if (historyWindow) {
    console.log('Destroying existing history window...');
    historyWindow.destroy();
    historyWindow = null;
  }

  // 创建新窗口
  historyWindow = new BrowserWindow({
    width: 600,
    height: 800,
    icon: path.join(__dirname, '../public/logo.png'),
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
  });

  console.log('Loading URL for history window...');

  // 添加 ESC 键监听
  historyWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && !input.alt && !input.control && !input.shift && !input.meta) {
      historyWindow?.hide();
    }
  });

  // 返回一个 Promise，确保窗口完全加载
  return new Promise<void>(async (resolve, reject) => {
    try {
      // 监听页面加载完成事件
      historyWindow!.webContents.once('did-finish-load', () => {
        console.log('Page finished loading');
        if (historyWindow) {
          historyWindow.show();
          historyWindow.focus();
          // 短暂延时后关闭置顶
          setTimeout(() => {
            if (historyWindow) {
              historyWindow.setAlwaysOnTop(false);
            }
          }, 300);
          console.log('History window is now visible and focused');
          resolve();
        }
      });

      // 监听加载失败事件
      historyWindow!.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load:', errorCode, errorDescription);
        reject(new Error(`Failed to load: ${errorDescription}`));
      });

      // 在开发环境中，尝试连接到 Vite 开发服务器
      const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';
      if (isDev) {
        const devServerUrl = 'http://localhost:5173';
        console.log('Development mode - Loading URL:', devServerUrl);
        await historyWindow!.loadURL(devServerUrl);
      } else {
        const filePath = path.join(__dirname, '../dist/index.html');
        console.log('Production mode - Loading file:', filePath);
        await historyWindow!.loadFile(filePath);
      }

      // 监听窗口关闭事件
      historyWindow!.on('closed', () => {
        console.log('History window closed');
        historyWindow = null;
      });

      // 监听窗口失去焦点事件
      historyWindow!.on('blur', () => {
        if (historyWindow && !historyWindow.webContents.isDevToolsOpened()) {
          historyWindow.hide();
        }
      });

    } catch (error) {
      console.error('Error loading history window:', error);
      reject(error);
    }
  });
}

// 注册快捷键
function registerShortcuts() {
  console.log('Registering shortcuts...');
  
  // 先注销所有快捷键
  globalShortcut.unregisterAll();
  console.log('All shortcuts unregistered');
  
  const shortcut = process.platform === 'darwin' ? 'CommandOrControl+Shift+V' : 'CommandOrControl+Shift+V';
  console.log('Attempting to register shortcut:', shortcut);
  
  try {
    const registered = globalShortcut.register(shortcut, async () => {
      console.log('Shortcut triggered! Creating/showing history window...');
      
      try {
        if (!historyWindow) {
          console.log('No history window exists, creating new one...');
          await createHistoryWindow();
        } else {
          console.log('History window exists, showing it...');
          historyWindow.show();
          historyWindow.focus();
          historyWindow.setAlwaysOnTop(true);
          setTimeout(() => {
            if (historyWindow) {
              historyWindow.setAlwaysOnTop(false);
            }
          }, 300);
        }
      } catch (error) {
        console.error('Error handling shortcut:', error);
      }
    });

    if (!registered) {
      console.error('快捷键注册失败:', shortcut);
    } else {
      console.log('快捷键注册成功:', shortcut);
    }
  } catch (error) {
    console.error('注册快捷键时出错:', error);
  }
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
    icon: path.join(__dirname, '../public/logo.png'),
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
            const newHistory = [newItem, ...history.filter(item => item.content !== newItem.content)].slice(0, 50);
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
          const newHistory = [newItem, ...history.filter(i => i.content !== dataUrl)].slice(0, 50);
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
          const newHistory = [newItem, ...history.filter(i => i.content !== newItem.content)].slice(0, 50);
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
  
  // 设置 Tray 图标
  tray = new Tray(path.join(__dirname, '../public/16.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => { mainWindow?.show(); } },
    { label: 'Quit', click: () => { app.quit(); } }
  ]);
  tray.setToolTip('ClipHarbor');
  tray.setContextMenu(contextMenu);

  // 注册 IPC 处理程序
  registerIpcHandlers();

  if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, '../public/logo.png'))
  }

  // 创建主窗口
  await createWindow();
  
  // 注册快捷键
  registerShortcuts();

  app.on('activate', async () => {
    // 如果没有窗口，或者所有窗口都被隐藏，则创建窗口
    if (BrowserWindow.getAllWindows().length === 0 || 
        BrowserWindow.getAllWindows().every(window => !window.isVisible())) {
      await createWindow();
    } else {
      // 尝试显示主窗口
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  // 开始监听剪贴板变化
  startClipboardMonitoring();
});

app.on('window-all-closed', () => {
  // 在 macOS 上也退出应用
  app.quit()
})

// 在应用退出前注销所有快捷键
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// 当应用退出前，清理资源
app.on('before-quit', () => {
  // 停止剪贴板监控
  if (global.clipboardInterval) {
    clearInterval(global.clipboardInterval)
  }
  
  // 关闭所有窗口
  BrowserWindow.getAllWindows().forEach(window => {
    window.destroy()
  })
  
  // 清理窗口引用
  mainWindow = null
  historyWindow = null
  tray = null;
})
