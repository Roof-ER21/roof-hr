import { NextResponse } from 'next/server';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  requestId?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode: number;
  details?: Record<string, any>;
}

export class ValidationError extends Error {
  constructor(message: string, public details?: Record<string, any>) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export function createSuccessResponse<T>(
  data: T,
  message?: string,
  statusCode: number = 200
): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, { status: statusCode });
}

export function createErrorResponse(
  error: string | Error | ApiError,
  statusCode?: number
): NextResponse<ApiResponse> {
  let errorMessage: string;
  let errorCode: string | undefined;
  let errorDetails: Record<string, any> | undefined;
  let status: number;

  if (typeof error === 'string') {
    errorMessage = error;
    status = statusCode || 500;
  } else if (error instanceof ValidationError) {
    errorMessage = error.message;
    errorCode = 'VALIDATION_ERROR';
    errorDetails = error.details;
    status = 400;
  } else if (error instanceof UnauthorizedError) {
    errorMessage = error.message;
    errorCode = 'UNAUTHORIZED';
    status = 401;
  } else if (error instanceof ForbiddenError) {
    errorMessage = error.message;
    errorCode = 'FORBIDDEN';
    status = 403;
  } else if (error instanceof NotFoundError) {
    errorMessage = error.message;
    errorCode = 'NOT_FOUND';
    status = 404;
  } else if (error instanceof ConflictError) {
    errorMessage = error.message;
    errorCode = 'CONFLICT';
    status = 409;
  } else if (error instanceof RateLimitError) {
    errorMessage = error.message;
    errorCode = 'RATE_LIMIT_EXCEEDED';
    status = 429;
  } else if ('statusCode' in error) {
    errorMessage = error.message;
    errorCode = error.code;
    errorDetails = error.details;
    status = error.statusCode;
  } else {
    errorMessage = error.message || 'Internal server error';
    status = statusCode || 500;
  }

  const response: ApiResponse = {
    success: false,
    error: errorMessage,
    timestamp: new Date().toISOString(),
  };

  const headers: Record<string, string> = {};

  // Add retry-after header for rate limit errors
  if (error instanceof RateLimitError && error.retryAfter) {
    headers['Retry-After'] = error.retryAfter.toString();
  }

  return NextResponse.json(response, { 
    status,
    headers: Object.keys(headers).length > 0 ? headers : undefined
  });
}

export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  console.error('API Error:', error);

  if (error instanceof Error) {
    return createErrorResponse(error);
  }

  return createErrorResponse('An unexpected error occurred', 500);
}

// Wrapper function for API routes with error handling
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse<ApiResponse<R>>>
) {
  return async (...args: T): Promise<NextResponse<ApiResponse<R>>> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error) as NextResponse<ApiResponse<R>>;
    }
  };
}

// Type-safe response helpers
export const ApiResponses = {
  success: <T>(data: T, message?: string, statusCode?: number) =>
    createSuccessResponse(data, message, statusCode),
  
  created: <T>(data: T, message?: string) =>
    createSuccessResponse(data, message, 201),
  
  noContent: () =>
    new NextResponse(null, { status: 204 }),
  
  badRequest: (message: string, details?: Record<string, any>) =>
    createErrorResponse(new ValidationError(message, details)),
  
  unauthorized: (message?: string) =>
    createErrorResponse(new UnauthorizedError(message)),
  
  forbidden: (message?: string) =>
    createErrorResponse(new ForbiddenError(message)),
  
  notFound: (message?: string) =>
    createErrorResponse(new NotFoundError(message)),
  
  conflict: (message: string) =>
    createErrorResponse(new ConflictError(message)),
  
  rateLimited: (message?: string, retryAfter?: number) =>
    createErrorResponse(new RateLimitError(message, retryAfter)),
  
  internalError: (message?: string) =>
    createErrorResponse(message || 'Internal server error', 500),
};

// Logging utilities
export function logApiRequest(method: string, path: string, userId?: string) {
  console.log(`[API] ${method} ${path}${userId ? ` - User: ${userId}` : ''}`);
}

export function logApiError(method: string, path: string, error: Error, userId?: string) {
  console.error(`[API Error] ${method} ${path}${userId ? ` - User: ${userId}` : ''}:`, error);
}