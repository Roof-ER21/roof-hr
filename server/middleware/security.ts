import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Rate limiting store
class RateLimitStore {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();

  increment(key: string, windowMs: number, maxRequests: number): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const existing = this.requests.get(key);

    if (!existing || now > existing.resetTime) {
      // Reset window
      const resetTime = now + windowMs;
      this.requests.set(key, { count: 1, resetTime });
      return { allowed: true, remaining: maxRequests - 1, resetTime };
    }

    existing.count++;
    this.requests.set(key, existing);

    return {
      allowed: existing.count <= maxRequests,
      remaining: Math.max(0, maxRequests - existing.count),
      resetTime: existing.resetTime
    };
  }

  // Clean up old entries periodically
  cleanup() {
    const now = Date.now();
    for (const [key, value] of Array.from(this.requests.entries())) {
      if (now > value.resetTime) {
        this.requests.delete(key);
      }
    }
  }
  
  // Clear specific IP or all entries
  clear(ip?: string) {
    if (ip) {
      this.requests.delete(ip);
    } else {
      this.requests.clear();
    }
  }
}

const rateLimitStore = new RateLimitStore();

// Clean up every 5 minutes
setInterval(() => rateLimitStore.cleanup(), 5 * 60 * 1000);

// Export function to clear rate limits
export function clearRateLimit(ip?: string) {
  rateLimitStore.clear(ip);
  console.log(`Rate limit cleared for ${ip || 'all IPs'}`);
}

// Whitelist for development and testing
const WHITELISTED_IPS = [
  '127.0.0.1',
  'localhost',
  '::1',
  '172.31.88.162', // Development server
  '::ffff:172.31.88.162', // IPv6 mapped IPv4
  '108.28.124.207' // Temporarily whitelist user IP
];

export function rateLimit(options: { windowMs: number; max: number; skipSuccessfulRequests?: boolean }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    
    // Skip rate limiting for whitelisted IPs
    if (WHITELISTED_IPS.includes(key)) {
      return next();
    }
    
    const result = rateLimitStore.increment(key, options.windowMs, options.max);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      return res.status(429).json({
        error: 'Too many requests, please try again later.',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
      });
    }

    next();
  };
}

// Input sanitization middleware
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  function sanitizeValue(value: any): any {
    if (typeof value === 'string') {
      // Remove potentially dangerous characters
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim();
    }
    
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    
    if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }
    
    return value;
  }

  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }

  next();
}

// Validation middleware factory
export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }
      return res.status(400).json({ error: 'Invalid request data' });
    }
  };
}

// CORS middleware
export function configureCORS(req: Request, res: Response, next: NextFunction) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5000'];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin || '')) {
    res.setHeader('Access-Control-Allow-Origin', origin || '');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
}

// Security logging middleware
export function securityLogger(req: Request, res: Response, next: NextFunction) {
  const suspiciousPatterns = [
    /(<script|javascript:|on\w+\s*=)/i,
    /(union\s+select|drop\s+table|delete\s+from)/i,
    /(\.\.|\/etc\/passwd|\/proc\/)/i
  ];

  const requestData = JSON.stringify({ body: req.body, query: req.query, params: req.params });
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      console.warn(`🚨 Suspicious request detected from ${req.ip}: ${req.method} ${req.path}`, {
        userAgent: req.headers['user-agent'],
        data: requestData
      });
      break;
    }
  }

  next();
}