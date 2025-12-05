import { NextRequest } from 'next/server';

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

class RateLimiter {
  private store = new Map<string, { count: number; reset: number }>();
  
  constructor(
    private limit: number = 5,
    private windowMs: number = 60000 // 1 minute
  ) {}

  check(identifier: string): RateLimitResult {
    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry || now > entry.reset) {
      this.store.set(identifier, { count: 1, reset: now + this.windowMs });
      return { success: true, remaining: this.limit - 1, reset: now + this.windowMs };
    }

    if (entry.count >= this.limit) {
      return { success: false, remaining: 0, reset: entry.reset };
    }

    entry.count++;
    this.store.set(identifier, entry);
    return { success: true, remaining: this.limit - entry.count, reset: entry.reset };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.reset) {
        this.store.delete(key);
      }
    }
  }
}

// Create rate limiters for different endpoints
export const authRateLimiter = new RateLimiter(5, 60000); // 5 attempts per minute
export const apiRateLimiter = new RateLimiter(100, 60000); // 100 requests per minute
export const uploadRateLimiter = new RateLimiter(10, 300000); // 10 uploads per 5 minutes

export function getRateLimitIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.ip || 'unknown';
  return ip;
}

export function withRateLimit(rateLimiter: RateLimiter) {
  return (request: NextRequest): RateLimitResult => {
    const identifier = getRateLimitIdentifier(request);
    return rateLimiter.check(identifier);
  };
}

// Cleanup function to run periodically
setInterval(() => {
  authRateLimiter.cleanup();
  apiRateLimiter.cleanup();
  uploadRateLimiter.cleanup();
}, 60000); // Cleanup every minute