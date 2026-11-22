import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unlink } from 'fs/promises';

// Set env before importing db module
process.env.TURSO_DATABASE_URL = 'file:./test.db';
delete process.env.TURSO_AUTH_TOKEN;

const { initDb, createNote, getNote, updateNote, createTask, updateTask, getAllContext, setContext } = await import('../src/db.js');

beforeAll(async () => {
  await initDb();
});

afterAll(async () => {
  try { await unlink('./test.db'); } catch {}
  try { await unlink('./test.db-shm'); } catch {}
  try { await unlink('./test.db-wal'); } catch {}
});

describe('createNote', () => {
  it('returns a note with correct fields', async () => {
    const note = await createNote('user1', 'Title', 'Content', ['tag1']);
    expect(note.title).toBe('Title');
    expect(note.content).toBe('Content');
    expect(note.tags).toEqual(['tag1']);
    expect(note.user_id).toBe('user1');
    expect(typeof note.id).toBe('string');
  });
});

describe('getNote', () => {
  it('returns undefined for wrong userId (cross-user isolation)', async () => {
    const note = await createNote('user2', 'Private', 'Secret', []);
    const result = await getNote('user3', note.id);
    expect(result).toBeUndefined();
  });
});

describe('updateNote', () => {
  it('returns undefined for wrong userId', async () => {
    const note = await createNote('user4', 'Note', 'Body', []);
    const result = await updateNote('user5', note.id, { title: 'Hacked' });
    expect(result).toBeUndefined();
  });
});

describe('createTask', () => {
  it('creates a task with correct fields', async () => {
    const task = await createTask('user1', 'My task', 'details', '2025-01-01');
    expect(task.title).toBe('My task');
    expect(task.details).toBe('details');
    expect(task.due_date).toBe('2025-01-01');
    expect(task.status).toBe('open');
  });
});

describe('updateTask', () => {
  it('updates a task correctly', async () => {
    const task = await createTask('user1', 'Task to update', undefined, undefined);
    const updated = await updateTask('user1', task.id, { status: 'done' });
    expect(updated?.status).toBe('done');
  });
});

describe('context', () => {
  it('setContext and getAllContext are scoped per userId', async () => {
    await setContext('ctxUser1', 'name', 'Alice');
    await setContext('ctxUser2', 'name', 'Bob');
    const ctx1 = await getAllContext('ctxUser1');
    const ctx2 = await getAllContext('ctxUser2');
    expect(ctx1.find(e => e.key === 'name')?.value).toBe('Alice');
    expect(ctx2.find(e => e.key === 'name')?.value).toBe('Bob');
  });
});
