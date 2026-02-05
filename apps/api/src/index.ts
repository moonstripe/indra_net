/**
 * IndraNet API
 * 
 * Cloudflare Workers + Hono + D1
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth';
import { basesRoutes } from './routes/bases';
import { usersRoutes } from './routes/users';
import { billingRoutes } from './routes/billing';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://indra.net'], // TODO: Configure per environment
  credentials: true,
}));

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'IndraNet API',
    version: '0.0.1',
    status: 'ok',
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
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default app;
