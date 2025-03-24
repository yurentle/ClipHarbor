import { clipboard, nativeImage } from 'electron';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ClipboardItem } from '../../types/clipboard';
import { store } from './store';
import { logger } from '../utils/logger';

export class ClipboardManager extends EventEmitter {
  private static instance: ClipboardManager | null = null;
  private interval: NodeJS.Timeout | null = null;
  private lastContent: string = '';
  private lastImage: string = '';
  private isMonitoring: boolean = false;

  private constructor() {
    super();
    this.cleanupOldItems();
  }

  public static getInstance(): ClipboardManager {
    if (!ClipboardManager.instance) {
      ClipboardManager.instance = new ClipboardManager();
    }
    return ClipboardManager.instance;
  }

  private async cleanupOldItems(): Promise<void> {
    try {
      const settings = store.get('settings');
      if (!settings || settings.retentionUnit === 'permanent') return;

      const history = store.get('clipboardHistory', []) as ClipboardItem[];
      const now = Date.now();
      let retentionMs: number;

      switch (settings.retentionUnit) {
        case 'days':
          retentionMs = settings.retentionPeriod * 24 * 60 * 60 * 1000;
          break;
        case 'months':
          retentionMs = settings.retentionPeriod * 30 * 24 * 60 * 60 * 1000;
          break;
        case 'years':
          retentionMs = settings.retentionPeriod * 365 * 24 * 60 * 60 * 1000;
          break;
        default:
          return;
      }

      const newHistory = history.filter(item => {
        const age = now - item.timestamp;
        return age < retentionMs || item.favorite;
      });

      if (newHistory.length !== history.length) {
        store.set('clipboardHistory', newHistory);
        logger.info(`Cleaned up ${history.length - newHistory.length} old items`);
      }
    } catch (error) {
      logger.error('Error cleaning up old items:', error);
    }
  }

  private getImageMetadata(dataUrl: string) {
    try {
      const img = nativeImage.createFromDataURL(dataUrl);
      const size = Buffer.from(dataUrl.split(',')[1], 'base64').length;
      const { width, height } = img.getSize();
      return { width, height, size };
    } catch (error) {
      logger.error('Error getting image metadata:', error);
      return { width: 0, height: 0, size: 0 };
    }
  }

  private handleClipboardChange(newItem: ClipboardItem) {
    try {
      const history = store.get('clipboardHistory', []) as ClipboardItem[];
      // 避免重复项，如果已存在则移到顶部
      const newHistory = [newItem, ...history.filter(i => i.content !== newItem.content)];
      store.set('clipboardHistory', newHistory);
      this.emit('change', newItem);
      logger.info('Clipboard changed:', { type: newItem.type, id: newItem.id });
    } catch (error) {
      logger.error('Error handling clipboard change:', error);
    }
  }

  public startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('Clipboard monitoring already started');
      return;
    }

    this.isMonitoring = true;
    this.interval = setInterval(() => {
      try {
        // 检查图片
        const image = clipboard.readImage();
        if (!image.isEmpty()) {
          const dataUrl = image.toDataURL();
          if (dataUrl !== this.lastImage) {
            this.lastImage = dataUrl;
            const metadata = this.getImageMetadata(dataUrl);
            const newItem: ClipboardItem = {
              id: uuidv4(),
              content: dataUrl,
              type: 'image',
              timestamp: Date.now(),
              favorite: false,
              metadata
            };
            this.handleClipboardChange(newItem);
          }
        } else {
          // 检查文本
          const text = clipboard.readText().trim();
          if (text && text !== this.lastContent) {
            this.lastContent = text;
            const newItem: ClipboardItem = {
              id: uuidv4(),
              content: text,
              type: 'text',
              timestamp: Date.now(),
              favorite: false
            };
            this.handleClipboardChange(newItem);
          }
        }
      } catch (error) {
        logger.error('Error monitoring clipboard:', error);
      }
    }, 1000);

    logger.info('Clipboard monitoring started');
  }

  public stopMonitoring(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isMonitoring = false;
      logger.info('Clipboard monitoring stopped');
    }
  }

  public writeToClipboard(item: ClipboardItem): boolean {
    try {
      if (item.type === 'image') {
        const image = nativeImage.createFromDataURL(item.content);
        clipboard.writeImage(image);
      } else {
        clipboard.writeText(item.content);
      }
      return true;
    } catch (error) {
      logger.error('Error writing to clipboard:', error);
      return false;
    }
  }
}

export const clipboardManager = ClipboardManager.getInstance(); 