/**
 * IndraBases routes - CRUD for .indra databases
 * 
 * Access model:
 * - Public bases: readable by anyone (no auth needed for GET/pull/status)
 * - Private bases: require auth for all operations
 * - Write operations (POST/PATCH/DELETE/push): always require auth + ownership
 */

import { Hono } from 'hono';
import type { Env, IndraBase, User } from '../types';
import { generateId, requireAuth, optionalAuth } from '../utils';

export const basesRoutes = new Hono<{ Bindings: Env }>();

/**
 * List user's bases (requires auth)
 */
basesRoutes.get('/', requireAuth, async (c) => {
  const user = c.get('user') as User;
  
  const bases = await c.env.DB.prepare(
    `SELECT * FROM indra_bases WHERE owner_id = ? ORDER BY updated_at DESC`
  ).bind(user.id).all<IndraBase>();
  
  return c.json({ bases: bases.results });
});

/**
 * Create a new base (requires auth)
 */
basesRoutes.post('/', requireAuth, async (c) => {
  const user = c.get('user') as User;
  const { name, description, visibility = 'private' } = await c.req.json<{
    name: string;
    description?: string;
    visibility?: 'public' | 'private';
  }>();
  
  if (!name || name.length < 1 || name.length > 100) {
    return c.json({ error: 'Invalid name' }, 400);
  }
  
  // Free tier limits: 3 bases, 50MB each - generous to demonstrate value
  if (user.tier === 'hobby') {
    const count = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM indra_bases WHERE owner_id = ?'
    ).bind(user.id).first<{ count: number }>();
    
    if (count && count.count >= 3) {
      return c.json({ error: 'Free tier limited to 3 databases. Upgrade to Pro for unlimited.' }, 403);
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
 * Get a base by owner/name (public bases accessible without auth)
 */
basesRoutes.get('/by-name/:owner/:name', optionalAuth, async (c) => {
  const user = c.get('user') as User | undefined;
  const owner = c.req.param('owner');
  const name = c.req.param('name');
  
  // First, find the owner user
  const ownerUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE github_username = ?'
  ).bind(owner).first<{ id: string }>();
  
  if (!ownerUser) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Find the base by owner_id and name
  const base = await c.env.DB.prepare(
    'SELECT * FROM indra_bases WHERE owner_id = ? AND name = ?'
  ).bind(ownerUser.id, name).first<IndraBase>();
  
  if (!base) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Check access: public bases are readable by anyone, private requires ownership
  if (base.visibility === 'private' && base.owner_id !== user?.id) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  return c.json({ base });
});

/**
 * Get a single base (public bases accessible without auth)
 */
basesRoutes.get('/:id', optionalAuth, async (c) => {
  const user = c.get('user') as User | undefined;
  const id = c.req.param('id');
  
  // Skip if this looks like a sub-route
  if (id === 'by-name') return c.notFound();
  
  const base = await c.env.DB.prepare(
    'SELECT * FROM indra_bases WHERE id = ?'
  ).bind(id).first<IndraBase>();
  
  if (!base) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Check access
  if (base.visibility === 'private' && base.owner_id !== user?.id) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  return c.json({ base });
});

/**
 * Update a base (requires auth + ownership)
 */
basesRoutes.patch('/:id', requireAuth, async (c) => {
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
 * Delete a base (requires auth + ownership)
 */
basesRoutes.delete('/:id', requireAuth, async (c) => {
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
 * Push .indra file to remote (requires auth + ownership)
 */
basesRoutes.post('/:id/push', requireAuth, async (c) => {
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
  
  // Check size limits based on tier - generous free tier: 50MB per base
  const maxSize = user.tier === 'hobby' ? 50 * 1024 * 1024 : // 50MB free
                  user.tier === 'pro' ? 1024 * 1024 * 1024 : // 1GB pro
                  Infinity;
  
  if (body.byteLength > maxSize) {
    return c.json({ error: `File too large. ${user.tier} tier limit: ${maxSize / 1024 / 1024}MB` }, 413);
  }
  
  // Try to extract head_hash from the request header (CLI can send it)
  const headHash = c.req.header('X-Indra-Head-Hash');
  
  // Upload to R2
  await c.env.STORAGE.put(base.storage_key, body, {
    httpMetadata: {
      contentType: 'application/octet-stream',
    },
    customMetadata: headHash ? { head_hash: headHash } : undefined,
  });
  
  // Update metadata including head_hash if provided
  if (headHash) {
    await c.env.DB.prepare(
      `UPDATE indra_bases SET size_bytes = ?, head_hash = ?, updated_at = datetime("now") WHERE id = ?`
    ).bind(body.byteLength, headHash, id).run();
  } else {
    await c.env.DB.prepare(
      `UPDATE indra_bases SET size_bytes = ?, updated_at = datetime("now") WHERE id = ?`
    ).bind(body.byteLength, id).run();
  }
  
  // Log sync
  await c.env.DB.prepare(
    `INSERT INTO sync_log (id, base_id, action, size_bytes) VALUES (?, ?, 'push', ?)`
  ).bind(generateId(), id, body.byteLength).run();
  
  return c.json({ success: true, size_bytes: body.byteLength, head_hash: headHash });
});

/**
 * Push visualization data (requires auth + ownership)
 */
basesRoutes.post('/:id/viz', requireAuth, async (c) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');
  
  const base = await c.env.DB.prepare(
    'SELECT * FROM indra_bases WHERE id = ?'
  ).bind(id).first<IndraBase>();
  
  if (!base || base.owner_id !== user.id) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Get the uploaded viz JSON
  const vizData = await c.req.json();
  
  if (!vizData || !vizData.thoughts || !vizData.meta) {
    return c.json({ error: 'Invalid visualization data' }, 400);
  }
  
  // Store viz data in R2 alongside the .indra file
  const vizKey = `${base.storage_key}.viz.json`;
  const vizJson = JSON.stringify(vizData);
  
  await c.env.STORAGE.put(vizKey, vizJson, {
    httpMetadata: {
      contentType: 'application/json',
    },
  });
  
  // Update thought count in base metadata
  await c.env.DB.prepare(
    `UPDATE indra_bases SET thought_count = ?, updated_at = datetime("now") WHERE id = ?`
  ).bind(vizData.meta.total_thoughts || 0, id).run();
  
  return c.json({ 
    success: true, 
    size_bytes: vizJson.length,
    thoughts: vizData.meta.total_thoughts,
    embedded: vizData.meta.embedded_thoughts,
  });
});

/**
 * Pull .indra file from remote (public bases readable without auth)
 */
basesRoutes.get('/:id/pull', optionalAuth, async (c) => {
  const user = c.get('user') as User | undefined;
  const id = c.req.param('id');
  
  const base = await c.env.DB.prepare(
    'SELECT * FROM indra_bases WHERE id = ?'
  ).bind(id).first<IndraBase>();
  
  if (!base) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Check access: public bases are readable by anyone
  if (base.visibility === 'private' && base.owner_id !== user?.id) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Get from R2
  const object = await c.env.STORAGE.get(base.storage_key);
  
  if (!object) {
    return c.json({ error: 'Database file not found' }, 404);
  }
  
  // Log sync (only if user is authenticated)
  if (user) {
    await c.env.DB.prepare(
      `INSERT INTO sync_log (id, base_id, action, size_bytes) VALUES (?, ?, 'pull', ?)`
    ).bind(generateId(), id, base.size_bytes).run();
  }
  
  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${base.name}.indra"`,
    },
  });
});

/**
 * Get remote status (public bases accessible without auth)
 */
basesRoutes.get('/:id/status', optionalAuth, async (c) => {
  const user = c.get('user') as User | undefined;
  const id = c.req.param('id');
  
  const base = await c.env.DB.prepare(
    'SELECT * FROM indra_bases WHERE id = ?'
  ).bind(id).first<IndraBase>();
  
  if (!base) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Check access
  if (base.visibility === 'private' && base.owner_id !== user?.id) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  return c.json({
    head_hash: base.head_hash,
    size_bytes: base.size_bytes,
    thought_count: base.thought_count,
    commit_count: base.commit_count,
    updated_at: base.updated_at,
    visibility: base.visibility,
  });
});

/**
 * Get visualization data for a base (public bases accessible without auth)
 * 
 * This endpoint returns pre-computed 3D positions for all thoughts in the base.
 * The positions are computed using PCA on the embedding vectors.
 * 
 * Response format matches indra_db VizExport:
 * {
 *   thoughts: [{ id, content, thought_type?, position: [x,y,z], has_embedding, created_at }],
 *   meta: { total_thoughts, embedded_thoughts, reduction_method, original_dim, variance_explained? }
 * }
 */
basesRoutes.get('/:id/viz', optionalAuth, async (c) => {
  const user = c.get('user') as User | undefined;
  const id = c.req.param('id');
  
  const base = await c.env.DB.prepare(
    'SELECT * FROM indra_bases WHERE id = ?'
  ).bind(id).first<IndraBase>();
  
  if (!base) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Check access
  if (base.visibility === 'private' && base.owner_id !== user?.id) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Check if we have cached viz data in R2
  const vizKey = `${base.storage_key}.viz.json`;
  const cached = await c.env.STORAGE.get(vizKey);
  
  if (cached) {
    // Return cached visualization
    const vizData = await cached.json();
    return c.json(vizData);
  }
  
  // No cached data - return empty viz export
  // The CLI should push viz data alongside the .indra file
  return c.json({
    thoughts: [],
    meta: {
      total_thoughts: base.thought_count || 0,
      embedded_thoughts: 0,
      reduction_method: 'none',
      original_dim: 0,
      variance_explained: null,
    },
    cached: false,
    message: 'No visualization data. Push with --viz flag to generate.',
  });
});

/**
 * Get commits list for a base (public bases accessible without auth)
 * 
 * This reads from the viz data which contains commit history.
 * Returns commits in a format suitable for timeline display.
 */
basesRoutes.get('/:id/commits', optionalAuth, async (c) => {
  const user = c.get('user') as User | undefined;
  const id = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '50');
  
  const base = await c.env.DB.prepare(
    'SELECT * FROM indra_bases WHERE id = ?'
  ).bind(id).first<IndraBase>();
  
  if (!base) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Check access
  if (base.visibility === 'private' && base.owner_id !== user?.id) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Read from viz data
  const vizKey = `${base.storage_key}.viz.json`;
  const cached = await c.env.STORAGE.get(vizKey);
  
  if (!cached) {
    return c.json({ 
      commits: [],
      message: 'No commit data. Push with --viz flag to populate.',
    });
  }
  
  const vizData = await cached.json() as { 
    commits?: Array<{
      hash: string;
      message: string;
      author: string;
      timestamp: number;
      parents: string[];
    }> 
  };
  
  if (!vizData.commits || vizData.commits.length === 0) {
    return c.json({ 
      commits: [],
      message: 'No commit history in viz data. Re-push with latest CLI.',
    });
  }
  
  // Transform to frontend format
  const commits = vizData.commits
    .slice(0, limit)
    .map(c => ({
      id: c.hash,
      hash: c.hash,
      message: c.message,
      author: c.author,
      timestamp: new Date(c.timestamp).toISOString(),
      parent_hash: c.parents[0] || null,
    }));
  
  return c.json({ commits });
});

/**
 * Get thoughts list for a base (public bases accessible without auth)
 * 
 * This reads from the viz data which contains thought content.
 * Returns thoughts in a format suitable for list display.
 */
basesRoutes.get('/:id/thoughts', optionalAuth, async (c) => {
  const user = c.get('user') as User | undefined;
  const id = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '50');
  
  const base = await c.env.DB.prepare(
    'SELECT * FROM indra_bases WHERE id = ?'
  ).bind(id).first<IndraBase>();
  
  if (!base) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Check access
  if (base.visibility === 'private' && base.owner_id !== user?.id) {
    return c.json({ error: 'Not found' }, 404);
  }
  
  // Read from viz data
  const vizKey = `${base.storage_key}.viz.json`;
  const cached = await c.env.STORAGE.get(vizKey);
  
  if (!cached) {
    return c.json({ 
      thoughts: [],
      message: 'No thoughts data. Push with --viz flag to populate.',
    });
  }
  
  const vizData = await cached.json() as { thoughts: Array<{
    id: string;
    content: string;
    thought_type?: string;
    has_embedding: boolean;
    created_at: number;
  }> };
  
  // Transform viz thoughts to list format
  const thoughts = vizData.thoughts
    .slice(0, limit)
    .map(t => ({
      id: t.id,
      thought_id: t.id,
      content: t.content,
      thought_type: t.thought_type,
      has_embedding: t.has_embedding,
      created_at: new Date(t.created_at).toISOString(),
      committed_at: new Date(t.created_at).toISOString(), // Use created_at as committed_at
    }));
  
  return c.json({ thoughts });
});
