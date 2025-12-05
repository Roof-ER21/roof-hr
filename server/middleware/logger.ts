import { Request, Response, NextFunction } from 'express';

export interface LogLevel {
  ERROR: 0;
  WARN: 1;
  INFO: 2;
  DEBUG: 3;
}

export const LOG_LEVELS: LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

export class Logger {
  private static instance: Logger;
  private logLevel: number;
  private enableConsole: boolean;
  private enableFile: boolean;

  private constructor() {
    this.logLevel = this.getLogLevelFromEnv();
    this.enableConsole = process.env.LOG_CONSOLE !== 'false';
    this.enableFile = process.env.LOG_FILE === 'true';
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private getLogLevelFromEnv(): number {
    const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    return LOG_LEVELS[level as keyof LogLevel] ?? LOG_LEVELS.INFO;
  }

  private shouldLog(level: number): boolean {
    return level <= this.logLevel;
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaString = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaString}`;
  }

  private writeLog(level: string, message: string, meta?: any): void {
    const formattedMessage = this.formatMessage(level, message, meta);
    
    if (this.enableConsole) {
      switch (level) {
        case 'ERROR':
          console.error(formattedMessage);
          break;
        case 'WARN':
          console.warn(formattedMessage);
          break;
        case 'INFO':
          console.info(formattedMessage);
          break;
        case 'DEBUG':
          console.debug(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
    }

    // In a production environment, you might want to write to files or external logging services
    if (this.enableFile) {
      // TODO: Implement file logging
    }
  }

  error(message: string, meta?: any): void {
    if (this.shouldLog(LOG_LEVELS.ERROR)) {
      this.writeLog('ERROR', message, meta);
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      this.writeLog('WARN', message, meta);
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      this.writeLog('INFO', message, meta);
    }
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      this.writeLog('DEBUG', message, meta);
    }
  }
}

// Singleton instance
export const logger = Logger.getInstance();

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, url, ip } = req;
  const userAgent = req.get('User-Agent') || '';

  // Log request start
  logger.info(`${method} ${url}`, {
    ip,
    userAgent: userAgent.substring(0, 100), // Limit length
    timestamp: new Date().toISOString()
  });

  // Override res.json to capture response
  const originalJson = res.json;
  let responseBody: any;

  res.json = function(body: any) {
    responseBody = body;
    return originalJson.call(this, body);
  };

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const message = `${method} ${url} ${statusCode} - ${duration}ms`;
    
    const meta: any = {
      method,
      url,
      statusCode,
      duration,
      ip,
      userAgent: userAgent.substring(0, 100)
    };

    // Include response body for errors (but limit size)
    if (statusCode >= 400 && responseBody) {
      const bodyString = JSON.stringify(responseBody);
      meta.response = bodyString.length > 500 ? bodyString.substring(0, 500) + '...' : bodyString;
    }

    logger[logLevel as keyof Logger](message, meta);
  });

  next();
}

// Health check logging
export function logHealthCheck(): void {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  logger.info('Health check', {
    uptime: `${Math.floor(uptime)}s`,
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
    },
    timestamp: new Date().toISOString()
  });
}

// Database operation logging
export function logDatabaseOperation(operation: string, table: string, duration: number, success: boolean, error?: Error): void {
  const message = `DB ${operation} on ${table} - ${duration}ms`;
  const meta = {
    operation,
    table,
    duration,
    success,
    timestamp: new Date().toISOString()
  };

  if (success) {
    logger.debug(message, meta);
  } else {
    logger.error(message, { ...meta, error: error?.message });
  }
}

// Security event logging
export function logSecurityEvent(event: string, details: any, severity: 'low' | 'medium' | 'high' = 'medium'): void {
  const message = `Security Event: ${event}`;
  const meta = {
    event,
    severity,
    details,
    timestamp: new Date().toISOString()
  };

  if (severity === 'high') {
    logger.error(message, meta);
  } else if (severity === 'medium') {
    logger.warn(message, meta);
  } else {
    logger.info(message, meta);
  }
}