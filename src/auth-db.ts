import { createClient } from "@libsql/client";

function getAuthClient() {
  const url = process.env.AUTH_DB_URL;
  const authToken = process.env.AUTH_DB_TOKEN;
  if (!url) throw new Error("AUTH_DB_URL is not set");
  return createClient(authToken ? { url, authToken } : { url });
}

export interface User {
  id: string;
  github_id: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
}

let authDbInitialized = false;
let authDbInitPromise: Promise<void> | null = null;

export async function initAuthDb(): Promise<void> {
  if (authDbInitialized) return;
  if (authDbInitPromise) return authDbInitPromise;
  authDbInitPromise = _initAuthDb().then(() => { authDbInitialized = true; });
  return authDbInitPromise;
}

async function _initAuthDb(): Promise<void> {
  const client = getAuthClient();
  await client.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      github_id TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      email TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS mcp_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    )`,
  ]);
}

// ---------------------------------------------------------------------------
// MCP bearer tokens
// ---------------------------------------------------------------------------

export async function createMcpToken(userId: string): Promise<string> {
  const client = getAuthClient();
  // Delete any existing token for this user first (one token per user)
  await client.execute({
    sql: "DELETE FROM mcp_tokens WHERE user_id = ?",
    args: [userId],
  });
  const token = `mcp_${crypto.randomUUID().replace(/-/g, "")}`;
  const now = new Date().toISOString();
  await client.execute({
    sql: "INSERT INTO mcp_tokens (token, user_id, created_at) VALUES (?, ?, ?)",
    args: [token, userId, now],
  });
  return token;
}

export async function getMcpToken(userId: string): Promise<string | null> {
  const client = getAuthClient();
  const r = await client.execute({
    sql: "SELECT token FROM mcp_tokens WHERE user_id = ?",
    args: [userId],
  });
  if (r.rows.length === 0) return null;
  return (r.rows[0] as Record<string, unknown>).token as string;
}

export async function getUserFromMcpToken(token: string): Promise<User | null> {
  const client = getAuthClient();
  const r = await client.execute({
    sql: `SELECT u.id, u.github_id, u.username, u.email, u.avatar_url, u.created_at
          FROM mcp_tokens t JOIN users u ON t.user_id = u.id
          WHERE t.token = ?`,
    args: [token],
  });
  if (r.rows.length === 0) return null;
  const row = r.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    github_id: row.github_id as string,
    username: row.username as string,
    email: (row.email as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export async function findOrCreateUser(
  githubId: string,
  username: string,
  email: string | null,
  avatarUrl: string | null
): Promise<User> {
  const client = getAuthClient();
  // Check for existing user
  const existing = await client.execute({
    sql: "SELECT * FROM users WHERE github_id = ?",
    args: [githubId],
  });
  if (existing.rows.length > 0) {
    const row = existing.rows[0] as Record<string, unknown>;
    // Update fields in case they changed
    await client.execute({
      sql: "UPDATE users SET username = ?, email = ?, avatar_url = ? WHERE github_id = ?",
      args: [username, email, avatarUrl, githubId],
    });
    return {
      id: row.id as string,
      github_id: row.github_id as string,
      username,
      email,
      avatar_url: avatarUrl,
      created_at: row.created_at as string,
    };
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await client.execute({
    sql: "INSERT INTO users (id, github_id, username, email, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [id, githubId, username, email, avatarUrl, now],
  });
  return { id, github_id: githubId, username, email, avatar_url: avatarUrl, created_at: now };
}

export async function createSession(userId: string): Promise<string> {
  const client = getAuthClient();
  const id = crypto.randomUUID();
  const now = new Date();
  const created_at = now.toISOString();
  const expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await client.execute({
    sql: "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    args: [id, userId, created_at, expires_at],
  });
  return id;
}

export async function getSessionUser(sessionId: string): Promise<User | null> {
  const client = getAuthClient();
  const r = await client.execute({
    sql: `SELECT u.id, u.github_id, u.username, u.email, u.avatar_url, u.created_at
          FROM sessions s JOIN users u ON s.user_id = u.id
          WHERE s.id = ? AND s.expires_at > ?`,
    args: [sessionId, new Date().toISOString()],
  });
  if (r.rows.length === 0) return null;
  const row = r.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    github_id: row.github_id as string,
    username: row.username as string,
    email: (row.email as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  const client = getAuthClient();
  await client.execute({
    sql: "DELETE FROM sessions WHERE id = ?",
    args: [sessionId],
  });
}
