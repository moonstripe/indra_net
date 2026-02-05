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
          'UPDATE users SET github_id = ?, avatar_url = ?, updated_at = datetime("now") WHERE id = ?'
        ).bind(String(githubUser.id), githubUser.avatar_url, existingUser.id).run();
        user = { ...existingUser, github_id: String(githubUser.id) };
      } else {
        // Create new user
        const userId = generateId();
        await c.env.DB.prepare(
          `INSERT INTO users (id, email, name, avatar_url, github_id, tier)
           VALUES (?, ?, ?, ?, ?, 'hobby')`
        ).bind(userId, email, githubUser.name || email.split('@')[0], githubUser.avatar_url, String(githubUser.id)).run();
        
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
