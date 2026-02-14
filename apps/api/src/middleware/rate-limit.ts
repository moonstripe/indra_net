/**
 * Rate limiting middleware for Cloudflare Workers
 * 
 * Uses KV to track request counts per IP with sliding window.
 * Different limits for different endpoints.
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types';

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

// Rate limit configs by path prefix
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Auth endpoints - stricter limits to prevent brute force
  '/auth/login': { windowMs: 60_000, maxRequests: 10 },
  '/auth/register': { windowMs: 60_000, maxRequests: 5 },
  '/auth/callback': { windowMs: 60_000, maxRequests: 20 },
  '/auth/cli/poll': { windowMs: 60_000, maxRequests: 60 }, // CLI polling is frequent
  
  // Write operations
  '/bases': { windowMs: 60_000, maxRequests: 60 },  // For POST/PATCH/DELETE
  
  // File operations - larger limits but still protected
  'push': { windowMs: 60_000, maxRequests: 30 },
  'pull': { windowMs: 60_000, maxRequests: 100 },
  
  // Billing - very strict
  '/billing': { windowMs: 60_000, maxRequests: 20 },
  
  // Default for everything else
  'default': { windowMs: 60_000, maxRequests: 200 },
};

function getConfig(path: string, method: string): RateLimitConfig {
  // Check for specific path matches
  if (path.includes('/push')) return RATE_LIMITS['push'];
  if (path.includes('/pull')) return RATE_LIMITS['pull'];
  
  // Check path prefixes
  for (const [prefix, config] of Object.entries(RATE_LIMITS)) {
    if (prefix !== 'default' && path.startsWith(prefix)) {
      return config;
    }
  }
  
  // Write operations get stricter limits
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return { windowMs: 60_000, maxRequests: 100 };
  }
  
  return RATE_LIMITS['default'];
}

function getClientIP(c: Context): string {
  // Cloudflare provides the real client IP
  return c.req.header('CF-Connecting-IP') ||
         c.req.header('X-Forwarded-For')?.split(',')[0].trim() ||
         c.req.header('X-Real-IP') ||
         'unknown';
}

export async function rateLimiter(c: Context<{ Bindings: Env }>, next: Next) {
  const path = new URL(c.req.url).pathname;
  const method = c.req.method;
  
  // Skip rate limiting for health check
  if (path === '/' && method === 'GET') {
    return next();
  }
  
  // Skip rate limiting for webhooks (they have their own verification)
  if (path.startsWith('/billing/webhook')) {
    return next();
  }
  
  const config = getConfig(path, method);
  const ip = getClientIP(c);
  const key = `ratelimit:${ip}:${path.split('/').slice(0, 3).join('/')}`;
  
  try {
    // Get current count from KV
    const data = await c.env.SESSIONS.get(key, 'json') as { count: number; resetAt: number } | null;
    const now = Date.now();
    
    let count = 1;
    let resetAt = now + config.windowMs;
    
    if (data) {
      if (now < data.resetAt) {
        // Within window - increment count
        count = data.count + 1;
        resetAt = data.resetAt;
      }
      // else: window expired, start fresh (count = 1)
    }
    
    // Check if over limit
    if (count > config.maxRequests) {
      const retryAfter = Math.ceil((resetAt - now) / 1000);
      
      c.header('X-RateLimit-Limit', config.maxRequests.toString());
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', Math.ceil(resetAt / 1000).toString());
      c.header('Retry-After', retryAfter.toString());
      
      return c.json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
        retryAfter,
      }, 429);
    }
    
    // Update count in KV
    await c.env.SESSIONS.put(key, JSON.stringify({ count, resetAt }), {
      expirationTtl: Math.ceil(config.windowMs / 1000) + 10, // Add buffer
    });
    
    // Add rate limit headers
    c.header('X-RateLimit-Limit', config.maxRequests.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - count).toString());
    c.header('X-RateLimit-Reset', Math.ceil(resetAt / 1000).toString());
    
  } catch (err) {
    // If rate limiting fails, log and continue (fail open)
    console.error('Rate limiting error:', err);
  }
  
  return next();
}
