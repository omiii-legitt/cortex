import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient(authToken ? { url, authToken } : { url });

// Run initDb only once per cold start
let dbInitialized = false;
let dbInitPromise: Promise<void> | null = null;

export async function initDb() {
  if (dbInitialized) return;
  if (dbInitPromise) return dbInitPromise;
  dbInitPromise = _initDb().then(
    () => { dbInitialized = true; },
    (err) => { dbInitPromise = null; throw err; } // reset on failure so next request retries
  );
  return dbInitPromise;
}

async function _initDb() {
  if (!process.env.TURSO_DATABASE_URL) {
    console.warn(
      "[db] TURSO_DATABASE_URL is not set — using local SQLite fallback (data will not persist on Vercel)"
    );
  }

  await client.batch([
    `CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      details TEXT,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS context (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ]);

  // Add user_id columns if they don't already exist
  for (const sql of [
    "ALTER TABLE notes ADD COLUMN user_id TEXT NOT NULL DEFAULT 'system'",
    "ALTER TABLE tasks ADD COLUMN user_id TEXT NOT NULL DEFAULT 'system'",
    "ALTER TABLE context ADD COLUMN user_id TEXT NOT NULL DEFAULT 'system'",
  ]) {
    try {
      await client.execute(sql);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Ignore "duplicate column" errors — the column already exists
      if (!msg.toLowerCase().includes("duplicate column") && !msg.toLowerCase().includes("already exists")) {
        throw err;
      }
    }
  }

  // Migrate context to context_v2 (composite primary key: user_id + key)
  await client.batch([
    `CREATE TABLE IF NOT EXISTS context_v2 (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    )`,
    // Migrate existing rows from context (which may have a user_id column now)
    `INSERT OR IGNORE INTO context_v2 (user_id, key, value, updated_at)
     SELECT COALESCE(user_id, 'system'), key, value, updated_at FROM context`,
  ]);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  details: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ContextEntry {
  user_id: string;
  key: string;
  value: string;
  updated_at: string;
}

function rowToNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    user_id: (row.user_id as string | undefined) ?? "system",
    title: row.title as string,
    content: row.content as string,
    tags: JSON.parse(row.tags as string) as string[],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    user_id: (row.user_id as string | undefined) ?? "system",
    title: row.title as string,
    details: (row.details as string | null) ?? null,
    due_date: (row.due_date as string | null) ?? null,
    status: row.status as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function rowToContext(row: Record<string, unknown>): ContextEntry {
  return {
    user_id: (row.user_id as string | undefined) ?? "system",
    key: row.key as string,
    value: row.value as string,
    updated_at: row.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function createNote(
  userId: string,
  title: string,
  content: string,
  tags: string[]
): Promise<Note> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const tagsJson = JSON.stringify(tags);
  await client.execute({
    sql: "INSERT INTO notes (id, user_id, title, content, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [id, userId, title, content, tagsJson, now, now],
  });
  return { id, user_id: userId, title, content, tags, created_at: now, updated_at: now };
}

export async function getNote(userId: string, id: string): Promise<Note | undefined> {
  const r = await client.execute({
    sql: "SELECT * FROM notes WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
  if (r.rows.length === 0) return undefined;
  return rowToNote(r.rows[0] as Record<string, unknown>);
}

export async function updateNote(
  userId: string,
  id: string,
  fields: { title?: string; content?: string; tags?: string[] }
): Promise<Note | undefined> {
  const existing = await getNote(userId, id);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const updated: Note = { ...existing, ...fields, updated_at: now };
  await client.execute({
    sql: "UPDATE notes SET title = ?, content = ?, tags = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    args: [updated.title, updated.content, JSON.stringify(updated.tags), now, id, userId],
  });
  return updated;
}

export async function searchNotes(userId: string, query: string, limit: number): Promise<Note[]> {
  const pattern = `%${query}%`;
  const r = await client.execute({
    sql: "SELECT * FROM notes WHERE user_id = ? AND (title LIKE ? OR content LIKE ?) ORDER BY updated_at DESC LIMIT ?",
    args: [userId, pattern, pattern, limit],
  });
  return r.rows.map((row) => rowToNote(row as Record<string, unknown>));
}

export async function getAllNotes(userId: string): Promise<Note[]> {
  const r = await client.execute({
    sql: "SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50",
    args: [userId],
  });
  return r.rows.map((row) => rowToNote(row as Record<string, unknown>));
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function createTask(
  userId: string,
  title: string,
  details?: string,
  due_date?: string
): Promise<Task> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await client.execute({
    sql: "INSERT INTO tasks (id, user_id, title, details, due_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'open', ?, ?)",
    args: [id, userId, title, details ?? null, due_date ?? null, now, now],
  });
  return {
    id,
    user_id: userId,
    title,
    details: details ?? null,
    due_date: due_date ?? null,
    status: "open",
    created_at: now,
    updated_at: now,
  };
}

export async function listTasks(userId: string, status?: string, limit?: number): Promise<Task[]> {
  const effectiveLimit = limit ?? 20;
  if (status) {
    const r = await client.execute({
      sql: "SELECT * FROM tasks WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?",
      args: [userId, status, effectiveLimit],
    });
    return r.rows.map((row) => rowToTask(row as Record<string, unknown>));
  }
  const r = await client.execute({
    sql: "SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    args: [userId, effectiveLimit],
  });
  return r.rows.map((row) => rowToTask(row as Record<string, unknown>));
}

export async function updateTask(
  userId: string,
  id: string,
  fields: {
    title?: string;
    details?: string;
    due_date?: string;
    status?: string;
  }
): Promise<Task | undefined> {
  const r = await client.execute({
    sql: "SELECT * FROM tasks WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
  if (r.rows.length === 0) return undefined;
  const existing = rowToTask(r.rows[0] as Record<string, unknown>);

  const now = new Date().toISOString();
  const updated: Task = { ...existing, ...fields, updated_at: now };
  await client.execute({
    sql: "UPDATE tasks SET title = ?, details = ?, due_date = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    args: [updated.title, updated.details, updated.due_date, updated.status, now, id, userId],
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Context (uses context_v2 table)
// ---------------------------------------------------------------------------

export async function getAllContext(userId: string): Promise<ContextEntry[]> {
  const r = await client.execute({
    sql: "SELECT * FROM context_v2 WHERE user_id = ? ORDER BY key",
    args: [userId],
  });
  return r.rows.map((row) => rowToContext(row as Record<string, unknown>));
}

export async function setContext(userId: string, key: string, value: string): Promise<ContextEntry> {
  const now = new Date().toISOString();
  await client.execute({
    sql: "INSERT INTO context_v2 (user_id, key, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    args: [userId, key, value, now],
  });
  return { user_id: userId, key, value, updated_at: now };
}
