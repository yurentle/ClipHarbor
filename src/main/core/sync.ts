import { ChildProcess, spawn } from 'child_process';
import { IpcMainInvokeEvent } from 'electron';
import { logger } from '../utils/logger';
import { store } from './store';
import path from 'path';
import fs from 'fs';

interface SyncProcess {
  process: ChildProcess;
  isFromCloud: boolean;
}

export class SyncManager {
  private static instance: SyncManager | null = null;
  private syncProcesses = new Map<string, SyncProcess>();

  private constructor() {}

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  private validateRcloneConfig(config: string): boolean {
    if (!config) {
      throw new Error('请提供 Rclone 配置');
    }

    const parts = config.split(':');
    if (parts.length !== 2) {
      throw new Error('Rclone 配置格式错误，应为 remote:path');
    }

    return true;
  }

  private async checkRcloneInstallation(): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        const process = spawn('rclone', ['version']);
        process.on('error', reject);
        process.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error('Rclone 命令执行失败'));
          }
        });
      });
    } catch (error) {
      throw new Error('未安装 rclone，请先安装 rclone 并配置远程存储');
    }
  }

  private setupProcessHandlers(
    process: ChildProcess,
    event: IpcMainInvokeEvent,
    processId: string
  ): void {
    let isTerminated = false;

    process.stdout?.on('data', (data: Buffer) => {
      if (!isTerminated) {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            event.sender.send('sync-progress', { 
              processId, 
              data: line.trim()
            });
          }
        });
      }
    });

    process.stderr?.on('data', (data: Buffer) => {
      if (!isTerminated) {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            event.sender.send('sync-progress', { 
              processId, 
              data: `错误: ${line.trim()}`
            });
          }
        });
      }
    });

    process.on('exit', (code: number | null) => {
      isTerminated = true;
      if (this.syncProcesses.has(processId)) {
        this.syncProcesses.delete(processId);
        event.sender.send('sync-progress', { 
          processId, 
          data: code === 0 ? '同步完成！' : `同步失败，退出码: ${code}`
        });
      }
    });
  }

  public async syncToCloud(
    event: IpcMainInvokeEvent,
    rcloneConfig: string,
    processId: string
  ): Promise<void> {
    try {
      this.validateRcloneConfig(rcloneConfig);
      await this.checkRcloneInstallation();

      const localPath = store.path;
      const localFile = path.join(localPath, 'clipboard-history.json');

      // 验证文件访问权限
      await fs.promises.access(localFile, fs.constants.R_OK);
      
      const command = ['copy', localFile, rcloneConfig, '-P', '--progress'];
      const displayCommand = command.map(arg => 
        arg.includes(' ') ? `"${arg}"` : arg
      ).join(' ');

      event.sender.send('sync-progress', { 
        processId, 
        data: `正在执行命令: rclone ${displayCommand}`
      });

      const rcloneProcess = spawn('rclone', command, {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.syncProcesses.set(processId, { process: rcloneProcess, isFromCloud: false });
      this.setupProcessHandlers(rcloneProcess, event, processId);

    } catch (error: any) {
      event.sender.send('sync-progress', { 
        processId, 
        data: `错误: ${error.message}`
      });
      throw error;
    }
  }

  public async syncFromCloud(
    event: IpcMainInvokeEvent,
    rcloneConfig: string,
    processId: string
  ): Promise<void> {
    try {
      this.validateRcloneConfig(rcloneConfig);
      await this.checkRcloneInstallation();

      const localPath = store.path;
      const localFile = path.join(localPath, 'clipboard-history.json');
      
      const command = ['copy', rcloneConfig, localFile, '-P', '--progress'];
      const displayCommand = command.map(arg => 
        arg.includes(' ') ? `"${arg}"` : arg
      ).join(' ');

      event.sender.send('sync-progress', { 
        processId, 
        data: `正在执行命令: rclone ${displayCommand}`
      });

      const rcloneProcess = spawn('rclone', command, {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.syncProcesses.set(processId, { process: rcloneProcess, isFromCloud: true });
      this.setupProcessHandlers(rcloneProcess, event, processId);

    } catch (error: any) {
      event.sender.send('sync-progress', { 
        processId, 
        data: `错误: ${error.message}`
      });
      throw error;
    }
  }

  public cancelSync(processId: string): boolean {
    const syncProcess = this.syncProcesses.get(processId);
    if (syncProcess) {
      syncProcess.process.kill();
      this.syncProcesses.delete(processId);
      return true;
    }
    return false;
  }

  public hasSyncInProgress(): boolean {
    return this.syncProcesses.size > 0;
  }

  public getSyncProcesses(): string[] {
    return Array.from(this.syncProcesses.keys());
  }
}

export const syncManager = SyncManager.getInstance(); 