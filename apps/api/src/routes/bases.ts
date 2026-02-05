/**
 * IndraBases routes - CRUD for .indra databases
 */

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Env, IndraBase, Session, User } from '../types';
import { generateId, requireAuth } from '../utils';

export const basesRoutes = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
basesRoutes.use('*', requireAuth);

/**
 * List user's bases
 */
basesRoutes.get('/', async (c) => {
  const user = c.get('user') as User;
  
  const bases = await c.env.DB.prepare(
    `SELECT * FROM indra_bases WHERE owner_id = ? ORDER BY updated_at DESC`
  ).bind(user.id).all<IndraBase>();
  
  return c.json({ bases: bases.results });
});

/**
 * Create a new base
 */
basesRoutes.post('/', async (c) => {
  const user = c.get('user') as User;
  const { name, description, visibility = 'private' } = await c.req.json<{
    name: string;
    description?: string;
    visibility?: 'public' | 'private';
  }>();
  
  if (!name || name.length < 1 || name.length > 100) {
    return c.json({ error: 'Invalid name' }, 400);
  }
  
  // Check tier limits
  if (user.tier === 'hobby') {
    const count = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM indra_bases WHERE owner_id = ?'
    ).bind(user.id).first<{ count: number }>();
    
    if (count && count.count >= 1) {
      return c.json({ error: 'Hobby tier limited to 1 database. Upgrade to Pro for unlimited.' }, 403);
    }
  }
  
  const id = generateId();
  const storageKey = `${user.id}/${id}.indra`;
  
  try {
    await c.env.DB.prepare(
      `INSERT INTO indra_bases (id, owner_id, name, description, visibility, storage_key)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, user.id, name, description || null, visibility, storageKey).run();
    
    const base = await c.env.DB.prepare(
      'SELECT * FROM indra_bases WHERE id = ?'
    ).bind(id).first<IndraBase>();
    
    return c.json({ base }, 201);
    
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return c.json({ error: 'A database with this name already exists' }, 409);
    }
    throw error;
  }
});

/**
 * Get a single base
 */
basesRoutes.get('/:id', async (c) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');
  
  const base = await c.env.DB.prepare(
    'SELECT * FROM indra_bases WHERE id = ?'
  ).bind(id).first<IndraBase>();
  
  if (!base) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Check access
  if (base.visibility === 'private' && base.owner_id !== user.id) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  return c.json({ base });
});

/**
 * Update a base
 */
basesRoutes.patch('/:id', async (c) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');
  const updates = await c.req.json<{
    name?: string;
    description?: string;
    visibility?: 'public' | 'private';
  }>();
  
  const base = await c.env.DB.prepare(
    'SELECT * FROM indra_bases WHERE id = ?'
  ).bind(id).first<IndraBase>();
  
  if (!base || base.owner_id !== user.id) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  const fields: string[] = [];
  const values: any[] = [];
  
  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.visibility !== undefined) {
    fields.push('visibility = ?');
    values.push(updates.visibility);
  }
  
  if (fields.length === 0) {
    return c.json({ base });
  }
  
  fields.push('updated_at = datetime("now")');
  values.push(id);
  
  await c.env.DB.prepare(
    `UPDATE indra_bases SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run();
  
  const updated = await c.env.DB.prepare(
    'SELECT * FROM indra_bases WHERE id = ?'
  ).bind(id).first<IndraBase>();
  
  return c.json({ base: updated });
});

/**
 * Delete a base
 */
basesRoutes.delete('/:id', async (c) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');
  
  const base = await c.env.DB.prepare(
    'SELECT * FROM indra_bases WHERE id = ?'
  ).bind(id).first<IndraBase>();
  
  if (!base || base.owner_id !== user.id) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Delete from R2
  try {
    await c.env.STORAGE.delete(base.storage_key);
  } catch {
    // Ignore R2 errors
  }
  
  // Delete from D1 (cascades to thoughts, commits, sync_log)
  await c.env.DB.prepare(
    'DELETE FROM indra_bases WHERE id = ?'
  ).bind(id).run();
  
  return c.json({ success: true });
});

/**
 * Push .indra file to remote
 */
basesRoutes.post('/:id/push', async (c) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');
  
  const base = await c.env.DB.prepare(
    'SELECT * FROM indra_bases WHERE id = ?'
  ).bind(id).first<IndraBase>();
  
  if (!base || base.owner_id !== user.id) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Get the uploaded file
  const body = await c.req.arrayBuffer();
  
  if (!body || body.byteLength === 0) {
    return c.json({ error: 'No file provided' }, 400);
  }
  
  // Check size limits based on tier
  const maxSize = user.tier === 'hobby' ? 10 * 1024 * 1024 : // 10MB
                  user.tier === 'pro' ? 1024 * 1024 * 1024 : // 1GB
                  Infinity;
  
  if (body.byteLength > maxSize) {
    return c.json({ error: `File too large. ${user.tier} tier limit: ${maxSize / 1024 / 1024}MB` }, 413);
  }
  
  // Upload to R2
  await c.env.STORAGE.put(base.storage_key, body, {
    httpMetadata: {
      contentType: 'application/octet-stream',
    },
  });
  
  // Update metadata
  // TODO: Parse .indra file to extract thought_count, commit_count, head_hash
  await c.env.DB.prepare(
    `UPDATE indra_bases SET size_bytes = ?, updated_at = datetime("now") WHERE id = ?`
  ).bind(body.byteLength, id).run();
  
  // Log sync
  await c.env.DB.prepare(
    `INSERT INTO sync_log (id, base_id, action, size_bytes) VALUES (?, ?, 'push', ?)`
  ).bind(generateId(), id, body.byteLength).run();
  
  return c.json({ success: true, size_bytes: body.byteLength });
});

/**
 * Pull .indra file from remote
 */
basesRoutes.get('/:id/pull', async (c) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');
  
  const base = await c.env.DB.prepare(
    'SELECT * FROM indra_bases WHERE id = ?'
  ).bind(id).first<IndraBase>();
  
  if (!base) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Check access
  if (base.visibility === 'private' && base.owner_id !== user.id) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Get from R2
  const object = await c.env.STORAGE.get(base.storage_key);
  
  if (!object) {
    return c.json({ error: 'Database file not found' }, 404);
  }
  
  // Log sync
  await c.env.DB.prepare(
    `INSERT INTO sync_log (id, base_id, action, size_bytes) VALUES (?, ?, 'pull', ?)`
  ).bind(generateId(), id, base.size_bytes).run();
  
  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${base.name}.indra"`,
    },
  });
});

/**
 * Get remote status (for sync decisions)
 */
basesRoutes.get('/:id/status', async (c) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');
  
  const base = await c.env.DB.prepare(
    'SELECT * FROM indra_bases WHERE id = ?'
  ).bind(id).first<IndraBase>();
  
  if (!base) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Check access
  if (base.visibility === 'private' && base.owner_id !== user.id) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  return c.json({
    head_hash: base.head_hash,
    size_bytes: base.size_bytes,
    thought_count: base.thought_count,
    commit_count: base.commit_count,
    updated_at: base.updated_at,
  });
});
