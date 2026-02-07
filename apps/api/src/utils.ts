/**
 * Utility functions
 */

import { getCookie } from 'hono/cookie';
import type { Context, Next } from 'hono';
import type { Env, Session, User } from './types';

/**
 * Generate a random ID (UUID v4 style)
 */
export function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  
  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Middleware to require authentication
 * Supports both session cookies and API key/access token auth (Bearer token)
 */
export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next) {
  // Check for API key in Authorization header
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7);
    const user = await verifyApiKey(c.env.DB, c.env.SESSIONS, apiKey);
    if (user) {
      c.set('user', user);
      return next();
    }
    return c.json({ error: 'Invalid API key' }, 401);
  }

  // Fall back to session cookie
  const sessionId = getCookie(c, 'session');
  
  if (!sessionId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const sessionData = await c.env.SESSIONS.get(sessionId, 'json') as Session | null;
  
  if (!sessionData || new Date(sessionData.expires_at) < new Date()) {
    return c.json({ error: 'Session expired' }, 401);
  }
  
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(sessionData.user_id).first<User>();
  
  if (!user) {
    return c.json({ error: 'User not found' }, 401);
  }
  
  c.set('user', user);
  
  return next();
}

/**
 * Middleware for optional authentication
 * Sets user if authenticated, otherwise continues without user
 * Use this for routes that work both with and without auth (e.g., public bases)
 */
export async function optionalAuth(c: Context<{ Bindings: Env }>, next: Next) {
  // Check for API key in Authorization header
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7);
    const user = await verifyApiKey(c.env.DB, c.env.SESSIONS, apiKey);
    if (user) {
      c.set('user', user);
    }
    // Don't fail on invalid API key for optional auth - just continue without user
    return next();
  }

  // Check session cookie
  const sessionId = getCookie(c, 'session');
  
  if (sessionId) {
    const sessionData = await c.env.SESSIONS.get(sessionId, 'json') as Session | null;
    
    if (sessionData && new Date(sessionData.expires_at) >= new Date()) {
      const user = await c.env.DB.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).bind(sessionData.user_id).first<User>();
      
      if (user) {
        c.set('user', user);
      }
    }
  }
  
  return next();
}

/**
 * Verify API key and return user
 * Supports both legacy API keys (ink_id_secret) and access tokens
 */
export async function verifyApiKey(
  db: D1Database,
  sessions: KVNamespace,
  apiKey: string
): Promise<User | null> {
  // Check if it's an access token (stored in KV)
  if (!apiKey.startsWith('ink_')) {
    const tokenData = await sessions.get(`access:${apiKey}`, 'json') as { user_id: string } | null;
    if (tokenData) {
      const user = await db.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).bind(tokenData.user_id).first<User>();
      return user;
    }
    return null;
  }
  
  // Legacy API keys are formatted as: ink_<id>_<secret>
  const parts = apiKey.split('_');
  if (parts.length !== 3 || parts[0] !== 'ink') {
    return null;
  }
  
  const keyId = parts[1];
  const secret = parts[2];
  
  // Hash the secret for comparison
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Look up the key
  const result = await db.prepare(
    `SELECT u.* FROM users u
     JOIN api_keys k ON k.user_id = u.id
     WHERE k.id = ? AND k.key_hash = ?`
  ).bind(keyId, keyHash).first<User>();
  
  if (result) {
    // Update last_used
    await db.prepare(
      'UPDATE api_keys SET last_used = datetime("now") WHERE id = ?'
    ).bind(keyId).run();
  }
  
  return result;
}
