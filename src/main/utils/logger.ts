import fs from 'fs';
import path from 'path';
import { PATHS } from './constants';

class Logger {
  private logFile: string;

  constructor() {
    // 确保日志目录存在
    if (!fs.existsSync(PATHS.logs)) {
      fs.mkdirSync(PATHS.logs, { recursive: true });
    }

    this.logFile = path.join(PATHS.logs, `app-${new Date().toISOString().split('T')[0]}.log`);
  }

  private writeLog(level: string, ...args: any[]) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : arg
    ).join(' ');
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;
    
    try {
      fs.appendFileSync(this.logFile, logMessage);
      console.log(`[${level}]`, message);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  log(...args: any[]) {
    this.writeLog('INFO', ...args);
  }

  error(...args: any[]) {
    this.writeLog('ERROR', ...args);
  }

  warn(...args: any[]) {
    this.writeLog('WARN', ...args);
  }

  info(...args: any[]) {
    this.writeLog('INFO', ...args);
  }
}

export const logger = new Logger(); 