import { createNote, getNote, updateNote, searchNotes } from "../db.js";

export async function handleCreateNote(
  userId: string,
  args: { title: string; content: string; tags?: string[] }
) {
  const note = await createNote(userId, args.title, args.content, args.tags ?? []);
  return { id: note.id, title: note.title, created_at: note.created_at };
}

export async function handleGetNote(userId: string, args: { id: string }) {
  const note = await getNote(userId, args.id);
  if (!note) return { error: `Note ${args.id} not found` };
  return note;
}

export async function handleUpdateNote(
  userId: string,
  args: { id: string; title?: string; content?: string; tags?: string[] }
) {
  const { id, ...fields } = args;
  const note = await updateNote(userId, id, fields);
  if (!note) return { error: `Note ${id} not found` };
  return note;
}

export async function handleSearchNotes(
  userId: string,
  args: { query: string; limit?: number }
) {
  const notes = await searchNotes(userId, args.query, args.limit ?? 10);
  return notes.map((n) => ({
    id: n.id,
    title: n.title,
    snippet: n.content.slice(0, 150),
    tags: n.tags,
    updated_at: n.updated_at,
  }));
}
