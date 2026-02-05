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
 */
export function requireAuth(c: Context<{ Bindings: Env }>, next: Next) {
  return async () => {
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
  };
}

/**
 * Verify API key and return user
 */
export async function verifyApiKey(
  db: D1Database,
  apiKey: string
): Promise<User | null> {
  // API keys are formatted as: ink_<id>_<secret>
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
