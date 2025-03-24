import { BaseWindow } from './windowManager';
import { WINDOW_SIZES, PATHS } from '../utils/constants';
import path from 'path';
import { logger } from '../utils/logger';
import { IS_DEV } from '../utils/constants';

export class SettingsWindow extends BaseWindow {
  private static instance: SettingsWindow | null = null;
  private isQuitting = false;

  private constructor() {
    super({
      ...WINDOW_SIZES.settings,
      icon: path.join(PATHS.resources, 'icons/logo_dock.png'),
      title: '设置 - ClipHarbor',
      center: true,
      resizable: true,
    });
  }

  public static getInstance(): SettingsWindow {
    if (!SettingsWindow.instance) {
      SettingsWindow.instance = new SettingsWindow();
    }
    return SettingsWindow.instance;
  }

  public async create(): Promise<void> {
    try {
      logger.info('Creating settings window...');
      
      await super.create();
      
      // 如果是新创建的窗口，加载设置页面
      if (this.window && !this.window.webContents.getURL()) {
        logger.info('Loading settings page...');
        try {
          await this.loadWindow('/settings');
        } catch (error) {
          logger.error('Failed to load settings page:', error);
          throw error;
        }
      }
      
      logger.info('Settings window created and loaded successfully');
    } catch (error) {
      logger.error('Error creating settings window:', error);
      throw error;
    }
  }

  protected setupWindowEvents(): void {
    if (!this.window) return;

    this.window.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.hide();
      }
    });

    this.window.on('closed', () => {
      logger.info('Settings window closed');
      SettingsWindow.instance = null;
    });

    this.window.webContents.on('did-finish-load', () => {
      logger.info('Settings window content loaded');
    });

    if (IS_DEV) {
      this.window.webContents.on('before-input-event', (event, input) => {
        if (input.control && input.key.toLowerCase() === 'i') {
          this.window?.webContents.toggleDevTools();
          event.preventDefault();
        }
      });
    }
  }

  public setQuitting(quitting: boolean): void {
    this.isQuitting = quitting;
  }
} 