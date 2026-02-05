/**
 * Users routes
 */

import { Hono } from 'hono';
import type { Env, User } from '../types';
import { requireAuth } from '../utils';

export const usersRoutes = new Hono<{ Bindings: Env }>();

/**
 * Get user profile
 */
usersRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  const user = await c.env.DB.prepare(
    'SELECT id, name, avatar_url, tier, created_at FROM users WHERE id = ?'
  ).bind(id).first();
  
  if (!user) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Get public bases count
  const basesCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM indra_bases 
     WHERE owner_id = ? AND visibility = 'public'`
  ).bind(id).first<{ count: number }>();
  
  return c.json({
    user: {
      ...user,
      public_bases_count: basesCount?.count || 0,
    },
  });
});

/**
 * Update current user's profile
 */
usersRoutes.patch('/me', requireAuth, async (c) => {
  const user = c.get('user') as User;
  const updates = await c.req.json<{
    name?: string;
  }>();
  
  const fields: string[] = [];
  const values: any[] = [];
  
  if (updates.name !== undefined) {
    if (updates.name.length < 1 || updates.name.length > 100) {
      return c.json({ error: 'Invalid name' }, 400);
    }
    fields.push('name = ?');
    values.push(updates.name);
  }
  
  if (fields.length === 0) {
    return c.json({ user });
  }
  
  fields.push('updated_at = datetime("now")');
  values.push(user.id);
  
  await c.env.DB.prepare(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run();
  
  const updated = await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(user.id).first<User>();
  
  return c.json({ user: updated });
});
