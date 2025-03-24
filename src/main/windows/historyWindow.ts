import { BrowserWindow } from 'electron';
import { BaseWindow } from './windowManager';
import { WINDOW_SIZES, PATHS, IS_DEV, IS_MAC } from '../utils/constants';
import path from 'path';
import { logger } from '../utils/logger';

export class HistoryWindow extends BaseWindow {
  private static instance: HistoryWindow | null = null;

  private constructor() {
    super({
      ...WINDOW_SIZES.history,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      vibrancy: IS_MAC ? 'menu' : undefined,
      visualEffectState: 'active',
      roundedCorners: true,
      icon: path.join(PATHS.resources, 'icons/logo_dock.png'),
      title: '剪贴板历史 - ClipHarbor',
      center: true,
      resizable: true,
    });
  }

  public static getInstance(): HistoryWindow {
    if (!HistoryWindow.instance) {
      HistoryWindow.instance = new HistoryWindow();
    }
    return HistoryWindow.instance;
  }

  public async create(): Promise<void> {
    try {
      logger.info('Creating history window...');
      
      await super.create();
      
      // 如果是新创建的窗口，加载历史页面
      if (this.window && !this.window.webContents.getURL()) {
        logger.info('Loading history page...');
        await this.loadWindow('/history');
      }
      
      logger.info('History window created and loaded successfully');
    } catch (error) {
      logger.error('Error creating history window:', error);
      throw error;
    }
  }

  protected setupWindowEvents(): void {
    if (!this.window) return;

    // ESC 键关闭窗口
    this.window.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'Escape' && !input.alt && !input.control && !input.shift && !input.meta) {
        this.hide();
      }
    });

    // 失去焦点时隐藏窗口
    this.window.on('blur', () => {
      if (!this.window?.webContents.isDevToolsOpened()) {
        this.hide();
      }
    });

    this.window.on('closed', () => {
      logger.info('History window closed');
      HistoryWindow.instance = null;
    });

    // 开发环境下支持快捷键打开开发者工具
    if (IS_DEV) {
      this.window.webContents.on('before-input-event', (event, input) => {
        if (input.control && input.key.toLowerCase() === 'i') {
          this.window?.webContents.toggleDevTools();
          event.preventDefault();
        }
      });
    }
  }

  public setPosition(x: number, y: number): void {
    this.window?.setPosition(x, y);
  }
} 