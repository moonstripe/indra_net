/**
 * IndraNet API
 * 
 * Cloudflare Workers + Hono + D1
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { authRoutes } from './routes/auth';
import { basesRoutes } from './routes/bases';
import { usersRoutes } from './routes/users';
import { billingRoutes } from './routes/billing';
import { rateLimiter } from './middleware/rate-limit';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// Security headers
app.use('*', secureHeaders({
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
}));

// Logger
app.use('*', logger());

// CORS - environment-aware
app.use('*', async (c, next) => {
  const isProd = c.env.ENVIRONMENT === 'production';
  
  // Production origins
  const prodOrigins = [
    'https://indradb.net',
    'https://www.indradb.net',
  ];
  
  // Check for Pages preview URLs (*.indra-net-web.pages.dev)
  const isPagesPreview = (origin: string) => 
    origin.endsWith('.indra-net-web.pages.dev') || origin === 'https://indra-net-web.pages.dev';
  
  // Development origins (only allowed in dev)
  const devOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
  ];
  
  const allowedOrigins = isProd ? prodOrigins : [...prodOrigins, ...devOrigins];
  
  const corsMiddleware = cors({
    origin: (origin) => {
      // Allow requests with no origin (mobile apps, curl, etc.) in dev only
      if (!origin) return isProd ? null : '*';
      // Allow Pages preview URLs in production
      if (isPagesPreview(origin)) return origin;
      return allowedOrigins.includes(origin) ? origin : null;
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Indra-Head-Hash'],
    exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400, // 24 hours
  });
  
  return corsMiddleware(c, next);
});

// Rate limiting
app.use('*', rateLimiter);

// Health check (no rate limit on this)
app.get('/', (c) => {
  return c.json({
    name: 'IndraNet API',
    version: '0.1.0',
    status: 'ok',
    environment: c.env.ENVIRONMENT,
  });
});

// API Routes
app.route('/auth', authRoutes);
app.route('/users', usersRoutes);
app.route('/bases', basesRoutes);
app.route('/billing', billingRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  
  // Don't leak error details in production
  const isProd = c.env.ENVIRONMENT === 'production';
  return c.json({ 
    error: isProd ? 'Internal Server Error' : err.message 
  }, 500);
});

export default app;
