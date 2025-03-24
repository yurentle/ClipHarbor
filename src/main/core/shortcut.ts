import { globalShortcut } from 'electron';
import { logger } from '../utils/logger';
import { DEFAULT_SETTINGS } from '../utils/constants';
import { HistoryWindow } from '../windows/historyWindow';

export class ShortcutManager {
  private static instance: ShortcutManager | null = null;
  private registeredShortcuts = new Set<string>();
  public readonly defaultShortcut = DEFAULT_SETTINGS.shortcut;

  private constructor() {}

  public static getInstance(): ShortcutManager {
    if (!ShortcutManager.instance) {
      ShortcutManager.instance = new ShortcutManager();
    }
    return ShortcutManager.instance;
  }

  private isValidShortcut(shortcut: string): boolean {
    try {
      // 检查快捷键格式
      const parts = shortcut.split('+').map(part => part.trim());
      if (parts.length < 2) {
        logger.warn('Shortcut must contain at least two parts:', shortcut);
        return false;
      }

      // 检查是否包含修饰键
      const modifiers = ['Command', 'Ctrl', 'Alt', 'Shift'];
      const hasModifier = parts.some(part => modifiers.includes(part));
      if (!hasModifier) {
        logger.warn('Shortcut must contain at least one modifier key:', shortcut);
        return false;
      }

      // 尝试注册快捷键（临时）
      const success = globalShortcut.register(shortcut, () => {});
      if (success) {
        globalShortcut.unregister(shortcut);
        return true;
      }

      logger.warn('Failed to register shortcut:', shortcut);
      return false;
    } catch (error) {
      logger.error('Error validating shortcut:', error);
      return false;
    }
  }

  private async handleShortcutTriggered(): Promise<void> {
    try {
      const historyWindow = HistoryWindow.getInstance();
      if (historyWindow.isVisible()) {
        historyWindow.hide();
      } else {
        await historyWindow.create();
      }
    } catch (error) {
      logger.error('Error handling shortcut trigger:', error);
    }
  }

  public register(shortcut: string): boolean {
    try {
      if (!this.isValidShortcut(shortcut)) {
        return false;
      }

      // 先注销之前的快捷键
      this.unregisterAll();

      const success = globalShortcut.register(shortcut, () => {
        logger.info('Shortcut triggered:', shortcut);
        this.handleShortcutTriggered();
      });

      if (success) {
        this.registeredShortcuts.add(shortcut);
        logger.info('Shortcut registered successfully:', shortcut);
      } else {
        logger.error('Failed to register shortcut:', shortcut);
      }

      return success;
    } catch (error) {
      logger.error('Error registering shortcut:', error);
      return false;
    }
  }

  public unregister(shortcut: string): void {
    try {
      if (this.registeredShortcuts.has(shortcut)) {
        globalShortcut.unregister(shortcut);
        this.registeredShortcuts.delete(shortcut);
        logger.info('Shortcut unregistered:', shortcut);
      }
    } catch (error) {
      logger.error('Error unregistering shortcut:', error);
    }
  }

  public unregisterAll(): void {
    try {
      globalShortcut.unregisterAll();
      this.registeredShortcuts.clear();
      logger.info('All shortcuts unregistered');
    } catch (error) {
      logger.error('Error unregistering all shortcuts:', error);
    }
  }

  public getRegisteredShortcuts(): string[] {
    return Array.from(this.registeredShortcuts);
  }
}

export const shortcutManager = ShortcutManager.getInstance(); 