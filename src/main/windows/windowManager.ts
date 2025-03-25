import { BrowserWindow, BrowserWindowConstructorOptions, ipcMain } from 'electron';
import { IS_DEV } from '../utils/constants';
import path from 'path';
import { logger } from '../utils/logger';

export abstract class BaseWindow {
  public window: BrowserWindow | null = null;
  protected readonly windowOptions: BrowserWindowConstructorOptions;
  private isCreating: boolean = false; // 添加标志位，防止重复创建

  constructor(options: BrowserWindowConstructorOptions) {
    this.windowOptions = {
      ...options,
      show: false, // 默认不显示窗口
      webPreferences: {
        ...options.webPreferences,
        preload: path.join(__dirname, '../preload/preload.js'),
        nodeIntegration: true,
        contextIsolation: true,
        sandbox: false,
      },
    };
  }

  protected async loadWindow(route?: string) {
    if (!this.window) return;

    try {
      if (IS_DEV) {
        const url = `http://localhost:5173${route ? `/#/${route}` : ''}`;
        logger.info(`Loading dev window with URL: ${url}`);
        await this.window.loadURL(url);
      } else {
        const indexPath = path.join(__dirname, '..', 'renderer', 'index.html');
        logger.info('Loading production window from:', indexPath);
        
        // 先加载 HTML 文件
        await this.window.loadFile(indexPath);
        
        // 如果有路由，再通过 hash 导航
        if (route) {
          const cleanRoute = route.startsWith('/') ? route.slice(1) : route;
          await this.window.webContents.executeJavaScript(
            `window.location.hash = '/${cleanRoute}'`
          );
        }
      }

      this.window.show();
      this.window.focus();
    } catch (error) {
      logger.error('Error loading window:', error);
      logger.error('Error details:', {
        isDev: IS_DEV,
        dirname: __dirname,
        route: route
      });
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  public async create(): Promise<void> {
    if (this.window) {
      // 如果窗口已存在，只需要显示和聚焦
      this.window.show();
      this.window.focus();
      return;
    }

    if (this.isCreating) {
      logger.info('Window is already being created, waiting...');
      return;
    }

    try {
      this.isCreating = true;
      logger.info('Creating new window...');
      this.window = new BrowserWindow(this.windowOptions);
      this.setupWindowEvents();
      logger.info('Window created successfully');
    } catch (error) {
      logger.error('Error creating window:', error);
      throw error;
    } finally {
      this.isCreating = false;
    }
  }

  public isVisible(): boolean {
    return this.window?.isVisible() ?? false;
  }

  public show(): void {
    if (this.window) {
      this.window.show();
      this.window.focus();
    }
  }

  public hide(): void {
    this.window?.hide();
  }

  public focus(): void {
    if (this.window) {
      this.window.show();
      this.window.focus();
    }
  }

  public destroy(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
      this.window = null;
    }
  }

  protected abstract setupWindowEvents(): void;
}

// 添加 IPC 处理程序
ipcMain.on('window-blur', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    win.blur()
  }
})

ipcMain.on('window-focus', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    win.focus()
  }
})

ipcMain.on('window-hide', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    win.hide()
  }
})

ipcMain.on('window-show', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    win.show()
  }
})

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    win.close()
  }
}) 