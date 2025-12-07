import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
}

export class AppErrorClass extends Error implements AppError {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(message: string, statusCode: number = 500, code?: string, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error types
export class ValidationError extends AppErrorClass {
  constructor(message: string = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppErrorClass {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppErrorClass {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppErrorClass {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

export class ConflictError extends AppErrorClass {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends AppErrorClass {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

export class InternalServerError extends AppErrorClass {
  constructor(message: string = 'Internal server error') {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}

// Error handler middleware
export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  // Log the error
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Handle different error types
  if (error instanceof ZodError) {
    const validationError = handleZodError(error);
    res.status(validationError.statusCode).json({
      error: validationError.message,
      code: validationError.code,
      details: validationError.details
    });
    return;
  }

  if (error instanceof AppErrorClass) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code
    });
    return;
  }

  // Handle database errors
  if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
    res.status(409).json({
      error: 'Resource already exists',
      code: 'DUPLICATE_RESOURCE'
    });
    return;
  }

  if (error.message.includes('foreign key constraint')) {
    res.status(400).json({
      error: 'Invalid reference to related resource',
      code: 'FOREIGN_KEY_ERROR'
    });
    return;
  }

  // Handle connection errors
  if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
    res.status(503).json({
      error: 'Service temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE'
    });
    return;
  }

  // Default error response
  const statusCode = (error as any).statusCode || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(statusCode).json({
    error: isDevelopment ? error.message : 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR',
    ...(isDevelopment && { stack: error.stack })
  });
}

// Handle Zod validation errors
function handleZodError(error: ZodError): { statusCode: number; message: string; code: string; details: any[] } {
  const details = error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
    received: (err as any).received
  }));

  return {
    statusCode: 400,
    message: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details
  };
}

// Async error wrapper
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 handler
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: `Route ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND'
  });
}