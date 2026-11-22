import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../../auth.js";
import { initDb, getAllNotes, listTasks, getAllContext } from "../../db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = user.id;
  await initDb();

  const [notes, tasks, context] = await Promise.all([
    getAllNotes(userId),
    listTasks(userId, undefined, 50),
    getAllContext(userId),
  ]);

  return res.status(200).json({
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      snippet: n.content.slice(0, 100),
      tags: n.tags,
      updated_at: n.updated_at,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      due_date: t.due_date,
      created_at: t.created_at,
    })),
    context: context.map((c) => ({
      key: c.key,
      value: c.value,
    })),
  });
}
