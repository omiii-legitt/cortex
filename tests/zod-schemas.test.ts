import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Mirror the schemas from src/server.ts
const schemas = {
  create_note: z.object({
    title: z.string().min(1).max(500),
    content: z.string().max(50000),
    tags: z.array(z.string().max(100)).max(20).optional(),
  }),
  get_note: z.object({ id: z.string().uuid() }),
  update_note: z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(500).optional(),
    content: z.string().max(50000).optional(),
    tags: z.array(z.string().max(100)).max(20).optional(),
  }),
  search_notes: z.object({
    query: z.string().min(1).max(500),
    limit: z.number().int().min(1).max(100).optional().default(10),
  }),
  create_task: z.object({
    title: z.string().min(1).max(500),
    details: z.string().max(10000).optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  list_tasks: z.object({
    status: z.enum(['open', 'in_progress', 'done']).optional(),
    limit: z.number().int().min(1).max(100).optional().default(20),
  }),
  update_task: z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(500).optional(),
    details: z.string().max(10000).optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    status: z.enum(['open', 'in_progress', 'done']).optional(),
  }),
  get_my_context: z.object({}),
  set_context: z.object({
    key: z.string().min(1).max(200),
    value: z.string().max(10000),
  }),
};

describe('Zod schemas', () => {
  it('create_note: valid input passes', () => {
    expect(schemas.create_note.safeParse({ title: 'T', content: 'C' }).success).toBe(true);
  });
  it('create_note: missing title fails', () => {
    expect(schemas.create_note.safeParse({ content: 'C' }).success).toBe(false);
  });
  it('create_note: title over max fails', () => {
    expect(schemas.create_note.safeParse({ title: 'a'.repeat(501), content: 'C' }).success).toBe(false);
  });
  it('get_note: valid uuid passes', () => {
    expect(schemas.get_note.safeParse({ id: '123e4567-e89b-12d3-a456-426614174000' }).success).toBe(true);
  });
  it('get_note: invalid uuid fails', () => {
    expect(schemas.get_note.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });
  it('create_task: valid date format passes', () => {
    expect(schemas.create_task.safeParse({ title: 'T', due_date: '2025-01-15' }).success).toBe(true);
  });
  it('create_task: invalid date format fails', () => {
    expect(schemas.create_task.safeParse({ title: 'T', due_date: '15/01/2025' }).success).toBe(false);
  });
  it('search_notes: valid input passes', () => {
    expect(schemas.search_notes.safeParse({ query: 'test' }).success).toBe(true);
  });
  it('search_notes: missing query fails', () => {
    expect(schemas.search_notes.safeParse({}).success).toBe(false);
  });
  it('set_context: valid input passes', () => {
    expect(schemas.set_context.safeParse({ key: 'k', value: 'v' }).success).toBe(true);
  });
  it('set_context: oversized value fails', () => {
    expect(schemas.set_context.safeParse({ key: 'k', value: 'x'.repeat(10001) }).success).toBe(false);
  });
});
