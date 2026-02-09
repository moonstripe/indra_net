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
  
  // Invalidate cached viz data so it gets recomputed on next request
  try {
    await c.env.STORAGE.delete(`${base.storage_key}.viz.json`);
  } catch {
    // Ignore deletion errors
  }
  
  // Try to parse the file and update thought_count
  try {
    const { parseIndraFile } = await import('../lib/indra-parser');
    const parsed = await parseIndraFile(body);
    await c.env.DB.prepare(
      `UPDATE indra_bases SET thought_count = ? WHERE id = ?`
    ).bind(parsed.thoughts.length, id).run();
  } catch {
    // Non-critical - viz endpoint will update it later
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
 * This endpoint computes 3D positions for all thoughts in the base on-demand
 * by parsing the .indra file and applying PCA to the embeddings.
 * Results are cached in R2 for subsequent requests.
 * 
 * Response format matches indra_db VizExport:
 * {
 *   thoughts: [{ id, content, thought_type?, position: [x,y,z], has_embedding, created_at }],
 *   commits: [{ hash, message, author, timestamp, parents }],
 *   meta: { total_thoughts, embedded_thoughts, reduction_method, original_dim, variance_explained? }
 * }
 */
basesRoutes.get('/:id/viz', optionalAuth, async (c) => {
  const user = c.get('user') as User | undefined;
  const id = c.req.param('id');
  const forceRecompute = c.req.query('recompute') === 'true';
  
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
  
  if (!forceRecompute) {
    const cached = await c.env.STORAGE.get(vizKey);
    if (cached) {
      const vizData = await cached.json();
      return c.json(vizData);
    }
  }
  
  // No cached data - compute from .indra file
  const indraFile = await c.env.STORAGE.get(base.storage_key);
  
  if (!indraFile) {
    return c.json({
      thoughts: [],
      commits: [],
      meta: {
        total_thoughts: 0,
        embedded_thoughts: 0,
        reduction_method: 'none',
        original_dim: 0,
        variance_explained: null,
      },
      cached: false,
      message: 'No .indra file found. Push your database first.',
    });
  }
  
  try {
    // Parse the .indra file
    const { parseIndraFile } = await import('../lib/indra-parser');
    const { pca3d } = await import('../lib/pca');
    
    const buffer = await indraFile.arrayBuffer();
    const parsed = await parseIndraFile(buffer);
    
    // Separate thoughts with and without embeddings
    const thoughtsWithEmbeddings = parsed.thoughts.filter(t => t.embedding && t.embedding.length > 0);
    const thoughtsWithoutEmbeddings = parsed.thoughts.filter(t => !t.embedding || t.embedding.length === 0);
    
    // Compute PCA on embeddings
    const embeddings = thoughtsWithEmbeddings.map(t => t.embedding!);
    const pcaResult = embeddings.length > 0 ? pca3d(embeddings) : { positions: [], varianceExplained: [0, 0, 0] as [number, number, number], mean: [] };
    
    // Compute which branches each thought belongs to
    // A thought belongs to a branch if it was created before or at the branch's HEAD commit timestamp
    const branchTimestamps = new Map<string, number>();
    const commitMap = new Map(parsed.commits.map(c => [c.hash, c]));
    
    for (const [branchName, branchHash] of parsed.branches.entries()) {
      const commit = commitMap.get(branchHash);
      if (commit) {
        branchTimestamps.set(branchName, commit.timestamp);
      }
    }
    
    // For more accurate branch membership, we trace commit ancestry
    // A thought belongs to a branch if its created_at <= the branch HEAD commit timestamp
    // AND it's reachable from that branch's commit history
    const getBranchAncestryTimestamps = (startHash: string): number[] => {
      const timestamps: number[] = [];
      const visited = new Set<string>();
      const queue = [startHash];
      while (queue.length > 0) {
        const hash = queue.shift()!;
        if (visited.has(hash) || hash === '0'.repeat(64)) continue;
        visited.add(hash);
        const commit = commitMap.get(hash);
        if (commit) {
          timestamps.push(commit.timestamp);
          queue.push(...commit.parents);
        }
      }
      return timestamps;
    };
    
    // For each branch, compute the set of commit timestamps in its history
    const branchCommitTimestamps = new Map<string, Set<number>>();
    for (const [branchName, branchHash] of parsed.branches.entries()) {
      const timestamps = getBranchAncestryTimestamps(branchHash);
      branchCommitTimestamps.set(branchName, new Set(timestamps));
    }
    
    // Determine which branches a thought belongs to
    // A thought belongs to branches where its created_at matches a commit timestamp in that branch's history
    const getThoughtBranches = (createdAt: number): string[] => {
      const branches: string[] = [];
      for (const [branchName, timestamps] of branchCommitTimestamps.entries()) {
        // Check if this thought's creation time is at or before any commit in this branch
        // We use a range check since timestamps might be slightly off
        const branchMaxTimestamp = branchTimestamps.get(branchName) || 0;
        if (createdAt <= branchMaxTimestamp) {
          // Check if the thought was created at a commit time in this branch's history
          // For simplicity, include if created before or at branch HEAD
          branches.push(branchName);
        }
      }
      return branches.length > 0 ? branches : ['main']; // Default to main if no match
    };
    
    // Build viz thoughts with branch info
    const vizThoughts = [
      ...thoughtsWithEmbeddings.map((t, i) => ({
        id: t.id,
        content: t.content,
        thought_type: t.thoughtType,
        position: pcaResult.positions[i] as [number, number, number],
        has_embedding: true,
        created_at: t.createdAt,
        branches: getThoughtBranches(t.createdAt),
      })),
      ...thoughtsWithoutEmbeddings.map(t => ({
        id: t.id,
        content: t.content,
        thought_type: t.thoughtType,
        position: [0.5, 0.5, 0.5] as [number, number, number],
        has_embedding: false,
        created_at: t.createdAt,
        branches: getThoughtBranches(t.createdAt),
      })),
    ];
    
    // Build viz commits
    const vizCommits = parsed.commits.map(c => ({
      hash: c.hash,
      message: c.message,
      author: c.author,
      timestamp: c.timestamp,
      parents: c.parents,
    }));
    
    // Build viz edges
    const vizEdges = parsed.edges.map(e => ({
      source: e.source,
      target: e.target,
      edge_type: e.edgeType,
      weight: e.weight,
      directed: e.directed,
    }));
    
    const originalDim = embeddings.length > 0 ? embeddings[0].length : 0;
    
    // Extract embedder model from first embedded thought's attrs
    const embedderModel = thoughtsWithEmbeddings.find(t => t.embedderModel)?.embedderModel ?? null;
    
    // Build branches list for meta
    const branchesList = Array.from(parsed.branches.entries()).map(([name, hash]) => ({
      name,
      hash,
      current: name === parsed.headRef,
    }));
    
    // Compute clusters on embedded thoughts
    const { kmeans, findClusterRepresentatives } = await import('../lib/clustering');
    const embeddedPositions = vizThoughts
      .filter(t => t.has_embedding)
      .map(t => t.position);
    
    let clusters = null;
    if (embeddedPositions.length >= 4) {
      const clusterResult = kmeans(embeddedPositions);
      
      // Map cluster assignments back to thought IDs
      const embeddedThoughtIds = vizThoughts
        .filter(t => t.has_embedding)
        .map(t => t.id);
      
      // Find representative thought for each cluster
      const representatives = findClusterRepresentatives(
        embeddedPositions,
        clusterResult.assignments,
        clusterResult.centroids
      );
      
      // Build cluster info with labels from representative thoughts
      const clusterLabels = representatives.map((repIdx, clusterId) => {
        if (repIdx < 0) return `Cluster ${clusterId + 1}`;
        const thought = vizThoughts.find(t => t.id === embeddedThoughtIds[repIdx]);
        // Use first 50 chars of content as label
        return thought?.content.slice(0, 50) || `Cluster ${clusterId + 1}`;
      });
      
      clusters = {
        assignments: Object.fromEntries(
          clusterResult.assignments.map((cluster, i) => [embeddedThoughtIds[i], cluster])
        ),
        centroids: clusterResult.centroids,
        sizes: clusterResult.sizes,
        labels: clusterLabels,
        k: clusterResult.centroids.length,
      };
    }
    
    const vizData = {
      thoughts: vizThoughts,
      edges: vizEdges,
      commits: vizCommits,
      branches: branchesList,
      clusters,
      meta: {
        total_thoughts: parsed.thoughts.length,
        embedded_thoughts: thoughtsWithEmbeddings.length,
        total_edges: parsed.edges.length,
        reduction_method: embeddings.length >= 4 ? 'pca' : (embeddings.length > 0 ? 'simple' : 'none'),
        original_dim: originalDim,
        variance_explained: pcaResult.varianceExplained,
        ...(embedderModel ? { embedder_model: embedderModel } : {}),
      },
    };
    
    // Cache the result in R2
    await c.env.STORAGE.put(vizKey, JSON.stringify(vizData), {
      httpMetadata: {
        contentType: 'application/json',
      },
    });
    
    // Update thought count in DB
    await c.env.DB.prepare(
      `UPDATE indra_bases SET thought_count = ?, updated_at = datetime("now") WHERE id = ?`
    ).bind(parsed.thoughts.length, id).run();
    
    return c.json(vizData);
    
  } catch (e) {
    console.error('Failed to compute viz:', e);
    return c.json({
      thoughts: [],
      commits: [],
      meta: {
        total_thoughts: 0,
        embedded_thoughts: 0,
        reduction_method: 'error',
        original_dim: 0,
        variance_explained: null,
      },
      error: `Failed to parse .indra file: ${e instanceof Error ? e.message : 'Unknown error'}`,
    }, 500);
  }
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
    // Try to compute viz data first
    const vizResponse = await fetch(`${c.req.url.replace('/commits', '/viz')}`);
    if (vizResponse.ok) {
      const vizData = await vizResponse.json() as { commits?: Array<any> };
      if (vizData.commits && vizData.commits.length > 0) {
        return c.json({ 
          commits: vizData.commits.slice(0, limit).map(commit => ({
            id: commit.hash,
            hash: commit.hash,
            message: commit.message,
            author: commit.author,
            timestamp: new Date(commit.timestamp).toISOString(),
            parent_hash: commit.parents[0] || null,
          }))
        });
      }
    }
    return c.json({ 
      commits: [],
      message: 'No commit data available.',
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
 * Get branches list for a base (public bases accessible without auth)
 * 
 * Returns all branches in the .indra file with their commit hashes.
 */
basesRoutes.get('/:id/branches', optionalAuth, async (c) => {
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
  
  // Parse .indra file to get branches
  const indraFile = await c.env.STORAGE.get(base.storage_key);
  
  if (!indraFile) {
    return c.json({ 
      branches: [],
      head: 'main',
      message: 'No .indra file found. Push your database first.',
    });
  }
  
  try {
    const { parseIndraFile } = await import('../lib/indra-parser');
    const buffer = await indraFile.arrayBuffer();
    const parsed = await parseIndraFile(buffer);
    
    // Convert branches Map to array format
    const branches = Array.from(parsed.branches.entries()).map(([name, hash]) => ({
      name,
      hash,
      current: name === parsed.headRef,
    }));
    
    return c.json({
      branches,
      head: parsed.headRef,
    });
    
  } catch (e) {
    console.error('Failed to parse branches:', e);
    return c.json({
      branches: [],
      head: 'main',
      error: `Failed to parse .indra file: ${e instanceof Error ? e.message : 'Unknown error'}`,
    }, 500);
  }
});

/**
 * Compare two branches (public bases accessible without auth)
 * 
 * Returns thoughts unique to each branch and common thoughts.
 * Useful for "changed minds" analytics.
 */
basesRoutes.get('/:id/branches/compare', optionalAuth, async (c) => {
  const user = c.get('user') as User | undefined;
  const id = c.req.param('id');
  const branch1 = c.req.query('branch1') || 'main';
  const branch2 = c.req.query('branch2');
  
  if (!branch2) {
    return c.json({ error: 'branch2 query parameter is required' }, 400);
  }
  
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
  
  // Parse .indra file
  const indraFile = await c.env.STORAGE.get(base.storage_key);
  
  if (!indraFile) {
    return c.json({ error: 'No .indra file found' }, 404);
  }
  
  try {
    const { parseIndraFile } = await import('../lib/indra-parser');
    const buffer = await indraFile.arrayBuffer();
    const parsed = await parseIndraFile(buffer);
    
    // Get commit hashes for both branches
    const hash1 = parsed.branches.get(branch1);
    const hash2 = parsed.branches.get(branch2);
    
    if (!hash1) {
      return c.json({ error: `Branch '${branch1}' not found` }, 404);
    }
    if (!hash2) {
      return c.json({ error: `Branch '${branch2}' not found` }, 404);
    }
    
    // Build commit ancestry for each branch
    const commitMap = new Map(parsed.commits.map(c => [c.hash, c]));
    
    const getAncestrySet = (startHash: string): Set<string> => {
      const ancestry = new Set<string>();
      const queue = [startHash];
      while (queue.length > 0) {
        const hash = queue.shift()!;
        if (ancestry.has(hash) || hash === '0'.repeat(64)) continue;
        ancestry.add(hash);
        const commit = commitMap.get(hash);
        if (commit) {
          queue.push(...commit.parents);
        }
      }
      return ancestry;
    };
    
    const ancestry1 = getAncestrySet(hash1);
    const ancestry2 = getAncestrySet(hash2);
    
    // Find common ancestor (commits in both ancestries)
    const commonCommits = new Set([...ancestry1].filter(h => ancestry2.has(h)));
    
    // Commits unique to each branch
    const uniqueToB1 = [...ancestry1].filter(h => !ancestry2.has(h));
    const uniqueToB2 = [...ancestry2].filter(h => !ancestry1.has(h));
    
    // For a proper comparison, we'd need to track which thoughts were added in which commits
    // For now, we'll return commit-level comparison
    const formatCommit = (hash: string) => {
      const commit = commitMap.get(hash);
      return commit ? {
        hash: commit.hash,
        message: commit.message,
        author: commit.author,
        timestamp: commit.timestamp,
      } : { hash, message: 'Unknown', author: 'Unknown', timestamp: 0 };
    };
    
    return c.json({
      branch1: {
        name: branch1,
        hash: hash1,
        uniqueCommits: uniqueToB1.map(formatCommit),
        totalCommits: ancestry1.size,
      },
      branch2: {
        name: branch2,
        hash: hash2,
        uniqueCommits: uniqueToB2.map(formatCommit),
        totalCommits: ancestry2.size,
      },
      commonAncestor: commonCommits.size > 0 ? {
        count: commonCommits.size,
        // Find the most recent common commit
        latestCommon: [...commonCommits]
          .map(h => commitMap.get(h))
          .filter(Boolean)
          .sort((a, b) => b!.timestamp - a!.timestamp)[0] ?? null,
      } : null,
      divergence: {
        branch1UniqueCount: uniqueToB1.length,
        branch2UniqueCount: uniqueToB2.length,
        commonCount: commonCommits.size,
      },
    });
    
  } catch (e) {
    console.error('Failed to compare branches:', e);
    return c.json({
      error: `Failed to parse .indra file: ${e instanceof Error ? e.message : 'Unknown error'}`,
    }, 500);
  }
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
    // Viz data not cached yet - try to compute it now from the .indra file
    try {
      const indraFile = await c.env.STORAGE.get(base.storage_key);
      if (indraFile) {
        const { parseIndraFile } = await import('../lib/indra-parser');
        const { pca3d } = await import('../lib/pca');
        
        const buffer = await indraFile.arrayBuffer();
        const parsed = await parseIndraFile(buffer);
        
        if (parsed.thoughts.length > 0) {
          // Compute viz and cache it
          const thoughtsWithEmbeddings = parsed.thoughts.filter(t => t.embedding && t.embedding.length > 0);
          const embeddings = thoughtsWithEmbeddings.map(t => t.embedding!);
          const pcaResult = embeddings.length > 0 ? pca3d(embeddings) : { positions: [], varianceExplained: [0, 0, 0] as [number, number, number], mean: [] };
          
          const vizThoughts = [
            ...thoughtsWithEmbeddings.map((t, i) => ({
              id: t.id,
              content: t.content,
              thought_type: t.thoughtType,
              position: pcaResult.positions[i] as [number, number, number],
              has_embedding: true,
              created_at: t.createdAt,
            })),
            ...parsed.thoughts.filter(t => !t.embedding || t.embedding.length === 0).map(t => ({
              id: t.id,
              content: t.content,
              thought_type: t.thoughtType,
              position: [0.5, 0.5, 0.5] as [number, number, number],
              has_embedding: false,
              created_at: t.createdAt,
            })),
          ];
          
          const vizData = {
            thoughts: vizThoughts,
            commits: parsed.commits.map(c => ({ hash: c.hash, message: c.message, author: c.author, timestamp: c.timestamp, parents: c.parents })),
            meta: {
              total_thoughts: parsed.thoughts.length,
              embedded_thoughts: thoughtsWithEmbeddings.length,
              reduction_method: embeddings.length >= 4 ? 'pca' : (embeddings.length > 0 ? 'simple' : 'none'),
              original_dim: embeddings.length > 0 ? embeddings[0].length : 0,
              variance_explained: pcaResult.varianceExplained,
            },
          };
          
          // Cache it
          await c.env.STORAGE.put(vizKey, JSON.stringify(vizData), {
            httpMetadata: { contentType: 'application/json' },
          });
          
          // Return thoughts
          const thoughts = vizThoughts.slice(0, limit).map(t => ({
            id: t.id,
            thought_id: t.id,
            content: t.content,
            thought_type: t.thought_type,
            has_embedding: t.has_embedding,
            created_at: new Date(t.created_at).toISOString(),
            committed_at: new Date(t.created_at).toISOString(),
          }));
          
          return c.json({ thoughts });
        }
      }
    } catch (e) {
      console.error('Failed to compute thoughts on-demand:', e);
    }
    
    return c.json({ 
      thoughts: [],
      message: 'No thoughts data available yet.',
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
