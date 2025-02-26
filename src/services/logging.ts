type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  action: string;
  details: any;
}

export class LoggingService {
  private static instance: LoggingService;
  private logs: LogEntry[] = [];

  private constructor() {}

  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  public log(level: LogLevel, action: string, details: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      action,
      details,
    };

    this.logs.push(entry);
    console[level](`[${entry.timestamp}] ${action}:`, details);
  }

  public info(action: string, details: any) {
    this.log('info', action, details);
  }

  public warn(action: string, details: any) {
    this.log('warn', action, details);
  }

  public error(action: string, details: any) {
    this.log('error', action, details);
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
  }
} 