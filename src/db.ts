import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient(authToken ? { url, authToken } : { url });

export async function initDb() {
  if (!process.env.TURSO_DATABASE_URL) {
    console.warn('[db] TURSO_DATABASE_URL is not set — using local SQLite fallback (data will not persist on Vercel)');
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
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  details: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ContextEntry {
  key: string;
  value: string;
  updated_at: string;
}

function rowToNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
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
    key: row.key as string,
    value: row.value as string,
    updated_at: row.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function createNote(
  title: string,
  content: string,
  tags: string[]
): Promise<Note> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const tagsJson = JSON.stringify(tags);
  await client.execute({
    sql: "INSERT INTO notes (id, title, content, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [id, title, content, tagsJson, now, now],
  });
  return { id, title, content, tags, created_at: now, updated_at: now };
}

export async function getNote(id: string): Promise<Note | undefined> {
  const r = await client.execute({
    sql: "SELECT * FROM notes WHERE id = ?",
    args: [id],
  });
  if (r.rows.length === 0) return undefined;
  return rowToNote(r.rows[0] as Record<string, unknown>);
}

export async function updateNote(
  id: string,
  fields: { title?: string; content?: string; tags?: string[] }
): Promise<Note | undefined> {
  const existing = await getNote(id);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const updated: Note = { ...existing, ...fields, updated_at: now };
  await client.execute({
    sql: "UPDATE notes SET title = ?, content = ?, tags = ?, updated_at = ? WHERE id = ?",
    args: [updated.title, updated.content, JSON.stringify(updated.tags), now, id],
  });
  return updated;
}

export async function searchNotes(query: string, limit: number): Promise<Note[]> {
  const pattern = `%${query}%`;
  const r = await client.execute({
    sql: "SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC LIMIT ?",
    args: [pattern, pattern, limit],
  });
  return r.rows.map((row) => rowToNote(row as Record<string, unknown>));
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function createTask(
  title: string,
  details?: string,
  due_date?: string
): Promise<Task> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await client.execute({
    sql: "INSERT INTO tasks (id, title, details, due_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'open', ?, ?)",
    args: [id, title, details ?? null, due_date ?? null, now, now],
  });
  return {
    id,
    title,
    details: details ?? null,
    due_date: due_date ?? null,
    status: "open",
    created_at: now,
    updated_at: now,
  };
}

export async function listTasks(status?: string, limit?: number): Promise<Task[]> {
  const effectiveLimit = limit ?? 20;
  if (status) {
    const r = await client.execute({
      sql: "SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC LIMIT ?",
      args: [status, effectiveLimit],
    });
    return r.rows.map((row) => rowToTask(row as Record<string, unknown>));
  }
  const r = await client.execute({
    sql: "SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?",
    args: [effectiveLimit],
  });
  return r.rows.map((row) => rowToTask(row as Record<string, unknown>));
}

export async function updateTask(
  id: string,
  fields: {
    title?: string;
    details?: string;
    due_date?: string;
    status?: string;
  }
): Promise<Task | undefined> {
  const r = await client.execute({
    sql: "SELECT * FROM tasks WHERE id = ?",
    args: [id],
  });
  if (r.rows.length === 0) return undefined;
  const existing = rowToTask(r.rows[0] as Record<string, unknown>);

  const now = new Date().toISOString();
  const updated: Task = { ...existing, ...fields, updated_at: now };
  await client.execute({
    sql: "UPDATE tasks SET title = ?, details = ?, due_date = ?, status = ?, updated_at = ? WHERE id = ?",
    args: [updated.title, updated.details, updated.due_date, updated.status, now, id],
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export async function getAllContext(): Promise<ContextEntry[]> {
  const r = await client.execute({
    sql: "SELECT * FROM context ORDER BY key",
    args: [],
  });
  return r.rows.map((row) => rowToContext(row as Record<string, unknown>));
}

export async function setContext(key: string, value: string): Promise<ContextEntry> {
  const now = new Date().toISOString();
  await client.execute({
    sql: "INSERT INTO context (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    args: [key, value, now],
  });
  return { key, value, updated_at: now };
}
