import { Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { PATHS } from '../utils/constants';
import { logger } from '../utils/logger';
import { SettingsWindow } from '../windows/settingsWindow';

export class TrayManager {
  private static instance: TrayManager | null = null;
  private tray: Tray | null = null;
  private contextMenu: Menu | null = null;
  private isQuitting: boolean = false;

  private constructor() {}

  public static getInstance(): TrayManager {
    if (!TrayManager.instance) {
      TrayManager.instance = new TrayManager();
    }
    return TrayManager.instance;
  }

  public create(): void {
    if (this.tray) {
      return;
    }

    try {
      // 构建托盘图标路径
      const iconName = 'logo_tray_Template@2x.png'
      const iconPath = path.join(PATHS.icons, iconName);
      logger.info('Loading tray icon from:', iconPath);

      // 创建托盘图标
      const icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) {
        throw new Error(`Failed to load tray icon from path: ${iconPath}`);
      }

      this.tray = new Tray(icon);
      this.tray.setToolTip('ClipHarbor');
      this.updateContextMenu();
      logger.info('Tray created successfully');
    } catch (error) {
      logger.error('Error creating tray:', error);
      throw error;
    }
  }

  private updateContextMenu(): void {
    if (!this.tray) return;

    this.contextMenu = Menu.buildFromTemplate([
      {
        label: '打开设置',
        click: async () => {
          await this.handleSettingsClick();
        }
      },
      {
        label: '退出',
        click: () => {
          this.isQuitting = true;
          logger.info('Quit from tray menu');
          this.destroy();
        }
      }
    ]);

    this.tray.setContextMenu(this.contextMenu);
  }

  private async handleSettingsClick() {
    try {
      const settingsWindow = SettingsWindow.getInstance();
      if (settingsWindow.window && !settingsWindow.window.isDestroyed()) {
        settingsWindow.show();
        settingsWindow.focus();
        return;
      }
      await settingsWindow.create();
    } catch (error) {
      logger.error('Error opening settings window:', error);
    }
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      this.contextMenu = null;
      logger.info('Tray destroyed');
    }
  }

  public setQuitting(quitting: boolean): void {
    this.isQuitting = quitting;
  }
}

export const trayManager = TrayManager.getInstance(); 