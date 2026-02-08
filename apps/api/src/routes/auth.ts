/**
 * Authentication routes
 */

import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env, User, Session } from '../types';
import { generateId } from '../utils';

export const authRoutes = new Hono<{ Bindings: Env }>();

// Session duration: 7 days
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Get current user from session
 */
authRoutes.get('/me', async (c) => {
  const sessionId = getCookie(c, 'session');
  
  if (!sessionId) {
    return c.json({ user: null }, 200);
  }
  
  // Get session from KV
  const sessionData = await c.env.SESSIONS.get(sessionId, 'json') as Session | null;
  
  if (!sessionData || new Date(sessionData.expires_at) < new Date()) {
    deleteCookie(c, 'session');
    return c.json({ user: null }, 200);
  }
  
  // Get user from D1
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(sessionData.user_id).first<User>();
  
  if (!user) {
    deleteCookie(c, 'session');
    return c.json({ user: null }, 200);
  }
  
  return c.json({ user });
});

/**
 * GitHub OAuth callback
 */
authRoutes.post('/github', async (c) => {
  const { code } = await c.req.json<{ code: string }>();
  
  if (!code) {
    return c.json({ error: 'Missing code' }, 400);
  }
  
  if (!c.env.GITHUB_CLIENT_ID || !c.env.GITHUB_CLIENT_SECRET) {
    return c.json({ error: 'GitHub OAuth not configured' }, 500);
  }
  
  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: c.env.GITHUB_CLIENT_ID,
        client_secret: c.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    
    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };
    
    if (tokenData.error || !tokenData.access_token) {
      return c.json({ error: 'Failed to exchange code' }, 400);
    }
    
    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
        'User-Agent': 'IndraNet',
      },
    });
    
    const githubUser = await userResponse.json() as {
      id: number;
      login: string;
      email: string;
      name: string;
      avatar_url: string;
    };
    
    // Get email if not public
    let email = githubUser.email;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
          'User-Agent': 'IndraNet',
        },
      });
      const emails = await emailsResponse.json() as { email: string; primary: boolean }[];
      email = emails.find(e => e.primary)?.email || emails[0]?.email;
    }
    
    if (!email) {
      return c.json({ error: 'Could not get email from GitHub' }, 400);
    }
    
    // Find or create user
    let user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE github_id = ?'
    ).bind(String(githubUser.id)).first<User>();
    
    if (!user) {
      // Check if email already exists
      const existingUser = await c.env.DB.prepare(
        'SELECT * FROM users WHERE email = ?'
      ).bind(email).first<User>();
      
      if (existingUser) {
        // Link GitHub to existing account
        await c.env.DB.prepare(
          'UPDATE users SET github_id = ?, github_username = ?, avatar_url = ?, updated_at = datetime("now") WHERE id = ?'
        ).bind(String(githubUser.id), githubUser.login, githubUser.avatar_url, existingUser.id).run();
        user = { ...existingUser, github_id: String(githubUser.id), github_username: githubUser.login };
      } else {
        // Create new user
        const userId = generateId();
        await c.env.DB.prepare(
          `INSERT INTO users (id, email, name, avatar_url, github_id, github_username, tier)
           VALUES (?, ?, ?, ?, ?, ?, 'hobby')`
        ).bind(userId, email, githubUser.name || email.split('@')[0], githubUser.avatar_url, String(githubUser.id), githubUser.login).run();
        
        user = await c.env.DB.prepare(
          'SELECT * FROM users WHERE id = ?'
        ).bind(userId).first<User>();
      }
    }
    
    if (!user) {
      return c.json({ error: 'Failed to create user' }, 500);
    }
    
    // Create session
    const sessionId = generateId();
    const session: Session = {
      user_id: user.id,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
    };
    
    await c.env.SESSIONS.put(sessionId, JSON.stringify(session), {
      expirationTtl: SESSION_DURATION_MS / 1000,
    });
    
    // Set cookie
    setCookie(c, 'session', sessionId, {
      httpOnly: true,
      secure: c.env.ENVIRONMENT === 'production',
      sameSite: 'Lax',
      maxAge: SESSION_DURATION_MS / 1000,
      path: '/',
    });
    
    return c.json({ user });
    
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

/**
 * Logout
 */
authRoutes.post('/logout', async (c) => {
  const sessionId = getCookie(c, 'session');
  
  if (sessionId) {
    await c.env.SESSIONS.delete(sessionId);
    deleteCookie(c, 'session');
  }
  
  return c.json({ success: true });
});

/**
 * CLI login flow - initiates OAuth and returns tokens to CLI
 * 
 * Flow:
 * 1. CLI calls GET /auth/cli/start to get a login URL + state token
 * 2. CLI opens browser to that URL (GitHub OAuth)
 * 3. User completes GitHub auth
 * 4. Callback creates access/refresh tokens
 * 5. CLI polls /auth/cli/poll/:state to get tokens (or callback redirects to localhost)
 */
authRoutes.get('/cli/start', async (c) => {
  if (!c.env.GITHUB_CLIENT_ID) {
    return c.json({ error: 'GitHub OAuth not configured' }, 500);
  }
  
  // Generate a state token for this CLI login attempt
  const state = generateId();
  const callbackUrl = new URL(c.req.url).origin + '/auth/cli/callback';
  
  // Store state temporarily (5 minute expiry)
  await c.env.SESSIONS.put(`cli_state:${state}`, JSON.stringify({
    created_at: Date.now(),
    status: 'pending',
  }), { expirationTtl: 300 });
  
  // Build GitHub OAuth URL
  const githubUrl = new URL('https://github.com/login/oauth/authorize');
  githubUrl.searchParams.set('client_id', c.env.GITHUB_CLIENT_ID);
  githubUrl.searchParams.set('redirect_uri', callbackUrl);
  githubUrl.searchParams.set('scope', 'user:email');
  githubUrl.searchParams.set('state', state);
  
  return c.json({
    url: githubUrl.toString(),
    state,
    poll_url: new URL(c.req.url).origin + `/auth/cli/poll/${state}`,
  });
});

/**
 * CLI OAuth callback - exchanges code for API key
 */
authRoutes.get('/cli/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  
  if (!code || !state) {
    return c.html('<h1>Error</h1><p>Missing code or state</p>');
  }
  
  // Verify state exists (don't delete yet - we need to update it with tokens)
  const stateData = await c.env.SESSIONS.get(`cli_state:${state}`);
  if (!stateData) {
    return c.html('<h1>Error</h1><p>Invalid or expired state</p>');
  }
  
  if (!c.env.GITHUB_CLIENT_ID || !c.env.GITHUB_CLIENT_SECRET) {
    return c.html('<h1>Error</h1><p>GitHub OAuth not configured</p>');
  }
  
  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: c.env.GITHUB_CLIENT_ID,
        client_secret: c.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    
    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };
    
    if (tokenData.error || !tokenData.access_token) {
      return c.html('<h1>Error</h1><p>Failed to authenticate with GitHub</p>');
    }
    
    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
        'User-Agent': 'IndraNet',
      },
    });
    
    const githubUser = await userResponse.json() as {
      id: number;
      login: string;
      email: string;
      name: string;
      avatar_url: string;
    };
    
    // Get email if not public
    let email = githubUser.email;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
          'User-Agent': 'IndraNet',
        },
      });
      const emails = await emailsResponse.json() as { email: string; primary: boolean }[];
      email = emails.find(e => e.primary)?.email || emails[0]?.email;
    }
    
    if (!email) {
      return c.html('<h1>Error</h1><p>Could not get email from GitHub</p>');
    }
    
    // Find or create user
    let user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE github_id = ?'
    ).bind(String(githubUser.id)).first<User>();
    
    if (!user) {
      const existingUser = await c.env.DB.prepare(
        'SELECT * FROM users WHERE email = ?'
      ).bind(email).first<User>();
      
      if (existingUser) {
        await c.env.DB.prepare(
          'UPDATE users SET github_id = ?, github_username = ?, avatar_url = ?, updated_at = datetime("now") WHERE id = ?'
        ).bind(String(githubUser.id), githubUser.login, githubUser.avatar_url, existingUser.id).run();
        user = existingUser;
      } else {
        const userId = generateId();
        await c.env.DB.prepare(
          `INSERT INTO users (id, email, name, avatar_url, github_id, github_username, tier)
           VALUES (?, ?, ?, ?, ?, ?, 'hobby')`
        ).bind(userId, email, githubUser.name || email.split('@')[0], githubUser.avatar_url, String(githubUser.id), githubUser.login).run();
        
        user = await c.env.DB.prepare(
          'SELECT * FROM users WHERE id = ?'
        ).bind(userId).first<User>();
      }
    }
    
    if (!user) {
      return c.html('<h1>Error</h1><p>Failed to create user</p>');
    }
    
    // Generate access and refresh tokens
    const accessToken = generateId() + generateId();
    const refreshToken = generateId() + generateId();
    
    // Store refresh token in KV (30 days)
    await c.env.SESSIONS.put(`refresh:${refreshToken}`, JSON.stringify({
      user_id: user.id,
      created_at: Date.now(),
    }), { expirationTtl: 30 * 24 * 60 * 60 });
    
    // Store access token in KV (1 hour)
    await c.env.SESSIONS.put(`access:${accessToken}`, JSON.stringify({
      user_id: user.id,
    }), { expirationTtl: 60 * 60 });
    
    // Update the CLI state with tokens so CLI can poll for them
    await c.env.SESSIONS.put(`cli_state:${state}`, JSON.stringify({
      status: 'complete',
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 60 * 60,
        user: {
          id: user.id,
          name: user.name,
          github_username: githubUser.login,
        },
      },
    }), { expirationTtl: 60 }); // Keep for 1 minute for CLI to poll
    
    // Return success page
    return c.html(`
<!DOCTYPE html>
<html>
<head>
  <title>Indra CLI Login</title>
  <style>
    body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; background: #1a1a2e; color: #eee; }
    .success { color: #4ade80; font-size: 3em; margin-bottom: 20px; }
    .info { background: #2a2a4e; padding: 15px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="success">✓</div>
  <h1>Login Successful!</h1>
  <p>Welcome, <strong>${user.name}</strong> (@${githubUser.login})</p>
  <div class="info">
    <p>Your CLI is now authenticated. You can close this window.</p>
    <p style="color: #888; font-size: 0.9em;">The CLI will automatically receive your credentials.</p>
  </div>
</body>
</html>
    `);
    
  } catch (error) {
    console.error('CLI OAuth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.html(`<h1>Error</h1><p>Authentication failed: ${errorMessage}</p>`);
  }
});

// Token duration constants
const ACCESS_TOKEN_DURATION = 60 * 60; // 1 hour in seconds
const REFRESH_TOKEN_DURATION = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * CLI poll endpoint - CLI polls this to get tokens after browser auth completes
 */
authRoutes.get('/cli/poll/:state', async (c) => {
  const state = c.req.param('state');
  
  const stateData = await c.env.SESSIONS.get(`cli_state:${state}`, 'json') as {
    status: string;
    tokens?: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user: { id: string; name: string; github_username?: string };
    };
  } | null;
  
  if (!stateData) {
    return c.json({ status: 'expired' }, 404);
  }
  
  if (stateData.status === 'pending') {
    return c.json({ status: 'pending' });
  }
  
  if (stateData.status === 'complete' && stateData.tokens) {
    // Clean up the state
    await c.env.SESSIONS.delete(`cli_state:${state}`);
    return c.json({
      status: 'complete',
      ...stateData.tokens,
    });
  }
  
  return c.json({ status: 'error' }, 500);
});

/**
 * Refresh access token using refresh token
 */
authRoutes.post('/refresh', async (c) => {
  const { refresh_token } = await c.req.json<{ refresh_token: string }>();
  
  if (!refresh_token) {
    return c.json({ error: 'Missing refresh_token' }, 400);
  }
  
  // Validate refresh token (stored in KV)
  const tokenData = await c.env.SESSIONS.get(`refresh:${refresh_token}`, 'json') as {
    user_id: string;
    created_at: number;
  } | null;
  
  if (!tokenData) {
    return c.json({ error: 'Invalid or expired refresh token' }, 401);
  }
  
  // Get user
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(tokenData.user_id).first<User>();
  
  if (!user) {
    return c.json({ error: 'User not found' }, 401);
  }
  
  // Generate new tokens
  const newAccessToken = generateId() + generateId();
  const newRefreshToken = generateId() + generateId();
  
  // Store new refresh token
  await c.env.SESSIONS.put(`refresh:${newRefreshToken}`, JSON.stringify({
    user_id: user.id,
    created_at: Date.now(),
  }), { expirationTtl: REFRESH_TOKEN_DURATION });
  
  // Store access token -> user mapping
  await c.env.SESSIONS.put(`access:${newAccessToken}`, JSON.stringify({
    user_id: user.id,
  }), { expirationTtl: ACCESS_TOKEN_DURATION });
  
  // Invalidate old refresh token
  await c.env.SESSIONS.delete(`refresh:${refresh_token}`);
  
  return c.json({
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
    expires_in: ACCESS_TOKEN_DURATION,
    user: {
      id: user.id,
      name: user.name,
      github_username: user.github_username,
    },
  });
});
