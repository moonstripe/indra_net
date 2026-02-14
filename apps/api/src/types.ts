/**
 * Environment bindings for Cloudflare Workers
 */
export interface Env {
  // D1 Database
  DB: D1Database;
  
  // R2 Storage for .indra files
  STORAGE: R2Bucket;
  
  // KV for sessions
  SESSIONS: KVNamespace;
  
  // Environment variables
  ENVIRONMENT: 'development' | 'production';
  APP_URL?: string; // e.g., https://indradb.net
  API_URL?: string; // e.g., https://api.indradb.net
  
  // OAuth secrets (set via wrangler secret)
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  
  // Stripe
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

/**
 * User tiers
 */
export type UserTier = 'hobby' | 'pro' | 'enterprise';

/**
 * Database visibility
 */
export type Visibility = 'public' | 'private';

/**
 * User model
 */
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  github_id?: string;
  github_username?: string;
  google_id?: string;
  tier: UserTier;
  stripe_customer_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * IndraBase model (a remote .indra database)
 */
export interface IndraBase {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  visibility: Visibility;
  storage_key: string;
  size_bytes: number;
  thought_count: number;
  commit_count: number;
  head_hash?: string;
  created_at: string;
  updated_at: string;
}

/**
 * API Key model
 */
export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string; // First 8 chars for display
  key_hash: string;
  last_used?: string;
  created_at: string;
}

/**
 * Session data stored in KV
 */
export interface Session {
  user_id: string;
  created_at: string;
  expires_at: string;
}
