import { app } from 'electron';
import { logger } from './utils/logger';
import { SettingsWindow } from './windows/settingsWindow';
import { HistoryWindow } from './windows/historyWindow';
import { clipboardManager } from './core/clipboard';
import { shortcutManager } from './core/shortcut';
import { trayManager } from './tray/trayManager';
import { store } from './core/store';
import { registerIpcHandlers } from './ipc/handlers';
import { IPC_CHANNELS } from './utils/constants';

// 错误处理
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

class Application {
  private static instance: Application;

  private constructor() {
  }

  public static getInstance(): Application {
    if (!Application.instance) {
      Application.instance = new Application();
    }
    return Application.instance;
  }

  public async initialize() {
    try {
      logger.info('App is ready, initializing...');
      
      // 注册 IPC 处理程序
      this.registerHandlers();

      // 初始化系统托盘
      await this.initializeTray();

      // 初始化剪贴板监控
      this.initializeClipboard();

      // 初始化快捷键
      this.initializeShortcuts();

      // 设置应用事件监听器
      this.setupEventListeners();

      logger.info('App initialization completed');
    } catch (error: any) {
      logger.error('Error during app initialization:', error.message);
      throw error;
    }
  }

  private registerHandlers() {
    registerIpcHandlers();
  }

  private async initializeTray() {
    // 隐藏 dock 图标 (macOS)
    if (process.platform === 'darwin') {
      app.dock?.hide();
    }

    await trayManager.create();
  }

  private initializeClipboard() {
    clipboardManager.startMonitoring();

    clipboardManager.on('change', (item) => {
      [SettingsWindow.getInstance(), HistoryWindow.getInstance()].forEach(window => {
        if (window.isVisible()) {
          window.window?.webContents.send(IPC_CHANNELS.CLIPBOARD.CHANGE, item);
        }
      });
    });
  }

  private initializeShortcuts() {
    const settings = store.get('settings');
    const shortcut = settings?.shortcut || shortcutManager.defaultShortcut;
    
    if (!shortcutManager.register(shortcut)) {
      logger.warn('Failed to register initial shortcut, trying default');
      shortcutManager.register(shortcutManager.defaultShortcut);
    }
  }

  private setupEventListeners() {
    app.on('activate', async () => {
      logger.info('App activated');
      await SettingsWindow.getInstance().create();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('before-quit', () => {
      logger.info('App is quitting...');
      this.cleanup();
    });
  }

  private cleanup() {
    trayManager.setQuitting(true);
    SettingsWindow.getInstance().setQuitting(true);
    shortcutManager.unregisterAll();
    clipboardManager.stopMonitoring();
    trayManager.destroy();
  }
}

// 启动应用
app.whenReady().then(() => {
  Application.getInstance().initialize().catch(error => {
    logger.error('Failed to initialize application:', error.message);
    app.quit();
  });
});
